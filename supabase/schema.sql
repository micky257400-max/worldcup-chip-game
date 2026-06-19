create extension if not exists pgcrypto;

create type public.match_status as enum ('scheduled', 'locked', 'settled');
create type public.bet_status as enum ('open', 'won', 'lost', 'refunded');
create type public.market_type as enum ('outcome', 'goal_diff', 'total_goals', 'total_corners');
create type public.ledger_type as enum ('initial_grant', 'stake', 'settlement', 'refund', 'daily_floor', 'adjustment');

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6)),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null,
  chips numeric(12, 2) not null default 1000 check (chips >= 0),
  created_at timestamptz not null default now(),
  unique (room_id, user_id),
  unique (room_id, nickname)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  home_team text not null,
  away_team text not null,
  starts_at timestamptz not null,
  status public.match_status not null default 'scheduled',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.bets (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  market public.market_type not null,
  option_key text not null,
  amount numeric(12, 2) not null check (amount > 0),
  payout numeric(12, 2),
  status public.bet_status not null default 'open',
  created_at timestamptz not null default now()
);

create index bets_room_match_user_idx on public.bets (room_id, match_id, user_id);
create index bets_match_market_idx on public.bets (match_id, market);

create table public.match_results (
  match_id uuid primary key references public.matches(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  home_goals integer not null check (home_goals >= 0),
  away_goals integer not null check (away_goals >= 0),
  home_corners integer not null check (home_corners >= 0),
  away_corners integer not null check (away_corners >= 0),
  entered_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.chip_ledger (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  bet_id uuid references public.bets(id) on delete set null,
  match_id uuid references public.matches(id) on delete set null,
  type public.ledger_type not null,
  amount numeric(12, 2) not null,
  balance_after numeric(12, 2) not null,
  note text,
  created_at timestamptz not null default now()
);

create index chip_ledger_room_user_idx on public.chip_ledger (room_id, user_id, created_at desc);

create table public.daily_floor_grants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  grant_date date not null,
  amount numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  unique (room_id, user_id, grant_date)
);

create or replace view public.room_leaderboard
with (security_invoker = true)
as
with bet_stats as (
  select
    room_id,
    user_id,
    coalesce(sum(amount), 0)::numeric(12, 2) as total_wagered,
    count(id) filter (where status = 'won') as won_count,
    count(id) filter (where status in ('won', 'lost')) as settled_count
  from public.bets
  group by room_id, user_id
),
profit_stats as (
  select
    room_id,
    user_id,
    coalesce(sum(amount) filter (where type in ('stake', 'settlement', 'refund')), 0)::numeric(12, 2) as total_profit
  from public.chip_ledger
  group by room_id, user_id
)
select
  rm.room_id,
  rm.user_id,
  rm.nickname,
  rm.chips,
  coalesce(bs.total_wagered, 0)::numeric(12, 2) as total_wagered,
  coalesce(ps.total_profit, 0)::numeric(12, 2) as total_profit,
  case
    when coalesce(bs.settled_count, 0) = 0 then 0
    else round(bs.won_count::numeric / bs.settled_count::numeric, 4)
  end as hit_rate
from public.room_members rm
left join bet_stats bs on bs.room_id = rm.room_id and bs.user_id = rm.user_id
left join profit_stats ps on ps.room_id = rm.room_id and ps.user_id = rm.user_id;

create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_room_owner(p_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.rooms
    where id = p_room_id and owner_id = auth.uid()
  );
$$;

create or replace function public.create_room_with_member(p_name text, p_nickname text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.rooms (name, owner_id)
  values (trim(p_name), v_user_id)
  returning id into v_room_id;

  insert into public.room_members (room_id, user_id, nickname, chips)
  values (v_room_id, v_user_id, trim(p_nickname), 1000);

  insert into public.chip_ledger (room_id, user_id, type, amount, balance_after, note)
  values (v_room_id, v_user_id, 'initial_grant', 1000, 1000, 'Join room initial chips');

  return v_room_id;
end;
$$;

create or replace function public.join_room_by_code(p_code text, p_nickname text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select id into v_room_id
  from public.rooms
  where code = upper(trim(p_code));

  if v_room_id is null then
    raise exception 'Room code not found';
  end if;

  insert into public.room_members (room_id, user_id, nickname, chips)
  values (v_room_id, v_user_id, trim(p_nickname), 1000)
  on conflict (room_id, user_id)
  do update set nickname = excluded.nickname
  returning room_id into v_room_id;

  insert into public.chip_ledger (room_id, user_id, type, amount, balance_after, note)
  select v_room_id, v_user_id, 'initial_grant', 1000, 1000, 'Join room initial chips'
  where not exists (
    select 1 from public.chip_ledger
    where room_id = v_room_id and user_id = v_user_id and type = 'initial_grant'
  );

  return v_room_id;
end;
$$;

create or replace function public.add_match(
  p_room_id uuid,
  p_home_team text,
  p_away_team text,
  p_starts_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id uuid;
begin
  if not exists (
    select 1 from public.rooms where id = p_room_id and owner_id = auth.uid()
  ) then
    raise exception 'Only the room owner can add matches';
  end if;

  insert into public.matches (room_id, home_team, away_team, starts_at, created_by)
  values (p_room_id, trim(p_home_team), trim(p_away_team), p_starts_at, auth.uid())
  returning id into v_match_id;

  return v_match_id;
end;
$$;

create or replace function public.place_bet(
  p_room_id uuid,
  p_match_id uuid,
  p_market public.market_type,
  p_option_key text,
  p_amount numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_member public.room_members%rowtype;
  v_match public.matches%rowtype;
  v_existing_match_stake numeric(12, 2);
  v_cap numeric(12, 2);
  v_bet_id uuid;
  v_new_balance numeric(12, 2);
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_amount <= 0 then
    raise exception 'Bet amount must be positive';
  end if;

  select * into v_member
  from public.room_members
  where room_id = p_room_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'You are not a member of this room';
  end if;

  select * into v_match
  from public.matches
  where id = p_match_id and room_id = p_room_id
  for update;

  if not found then
    raise exception 'Match not found';
  end if;

  if v_match.status <> 'scheduled' or v_match.starts_at <= now() then
    update public.matches set status = 'locked'
    where id = v_match.id and status = 'scheduled';
    raise exception 'Match is locked';
  end if;

  select coalesce(sum(amount), 0) into v_existing_match_stake
  from public.bets
  where room_id = p_room_id
    and match_id = p_match_id
    and user_id = v_user_id;

  v_cap := floor((v_member.chips + v_existing_match_stake) * 0.30 * 100) / 100;

  if v_existing_match_stake + p_amount > v_cap then
    raise exception 'Single-match stake cap exceeded. Limit is % chips', v_cap;
  end if;

  if p_amount > v_member.chips then
    raise exception 'Insufficient chips';
  end if;

  v_new_balance := v_member.chips - p_amount;

  insert into public.bets (room_id, match_id, user_id, market, option_key, amount)
  values (p_room_id, p_match_id, v_user_id, p_market, trim(p_option_key), p_amount)
  returning id into v_bet_id;

  update public.room_members
  set chips = v_new_balance
  where id = v_member.id;

  insert into public.chip_ledger (room_id, user_id, bet_id, match_id, type, amount, balance_after, note)
  values (p_room_id, v_user_id, v_bet_id, p_match_id, 'stake', -p_amount, v_new_balance, 'Bet placed');

  return v_bet_id;
end;
$$;

create or replace function public.lock_due_matches(p_room_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not exists (
    select 1 from public.room_members where room_id = p_room_id and user_id = auth.uid()
  ) then
    raise exception 'Room membership required';
  end if;

  update public.matches
  set status = 'locked'
  where room_id = p_room_id
    and status = 'scheduled'
    and starts_at <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.apply_daily_floor(p_room_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_member record;
  v_amount numeric(12, 2);
begin
  if not exists (
    select 1 from public.room_members where room_id = p_room_id and user_id = auth.uid()
  ) then
    raise exception 'Room membership required';
  end if;

  if not exists (
    select 1 from public.matches
    where room_id = p_room_id and starts_at::date = current_date
  ) then
    return 0;
  end if;

  for v_member in
    select * from public.room_members
    where room_id = p_room_id and chips < 300
    for update
  loop
    v_amount := 300 - v_member.chips;

    insert into public.daily_floor_grants (room_id, user_id, grant_date, amount)
    values (p_room_id, v_member.user_id, current_date, v_amount)
    on conflict do nothing;

    if found then
      update public.room_members
      set chips = 300
      where id = v_member.id;

      insert into public.chip_ledger (room_id, user_id, type, amount, balance_after, note)
      values (p_room_id, v_member.user_id, 'daily_floor', v_amount, 300, 'Daily low-balance floor');

      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

create or replace function public.settle_match(
  p_match_id uuid,
  p_home_goals integer,
  p_away_goals integer,
  p_home_corners integer,
  p_away_corners integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_result_outcome text;
  v_result_goal_diff text;
  v_result_total_goals text;
  v_result_total_corners text;
  v_market public.market_type;
  v_winning_option text;
  v_pool numeric(12, 2);
  v_winning_stake numeric(12, 2);
  v_bet record;
  v_payout numeric(12, 2);
  v_new_balance numeric(12, 2);
begin
  select * into v_match from public.matches where id = p_match_id for update;

  if not found then
    raise exception 'Match not found';
  end if;

  if not exists (
    select 1 from public.rooms where id = v_match.room_id and owner_id = auth.uid()
  ) then
    raise exception 'Only the room owner can settle matches';
  end if;

  if v_match.status = 'settled' then
    raise exception 'Match already settled';
  end if;

  if p_home_goals < 0 or p_away_goals < 0 or p_home_corners < 0 or p_away_corners < 0 then
    raise exception 'Result values must be non-negative';
  end if;

  v_result_outcome := case
    when p_home_goals > p_away_goals then 'HOME'
    when p_home_goals < p_away_goals then 'AWAY'
    else 'DRAW'
  end;
  v_result_goal_diff := (p_home_goals - p_away_goals)::text;
  v_result_total_goals := (p_home_goals + p_away_goals)::text;
  v_result_total_corners := (p_home_corners + p_away_corners)::text;

  insert into public.match_results (
    match_id,
    room_id,
    home_goals,
    away_goals,
    home_corners,
    away_corners,
    entered_by
  )
  values (
    p_match_id,
    v_match.room_id,
    p_home_goals,
    p_away_goals,
    p_home_corners,
    p_away_corners,
    auth.uid()
  );

  foreach v_market in array enum_range(null::public.market_type)
  loop
    v_winning_option := case v_market
      when 'outcome' then v_result_outcome
      when 'goal_diff' then v_result_goal_diff
      when 'total_goals' then v_result_total_goals
      when 'total_corners' then v_result_total_corners
    end;

    select coalesce(sum(amount), 0) into v_pool
    from public.bets
    where match_id = p_match_id and market = v_market and status = 'open';

    if v_pool = 0 then
      continue;
    end if;

    select coalesce(sum(amount), 0) into v_winning_stake
    from public.bets
    where match_id = p_match_id
      and market = v_market
      and option_key = v_winning_option
      and status = 'open';

    if v_winning_stake = 0 then
      for v_bet in
        select * from public.bets
        where match_id = p_match_id and market = v_market and status = 'open'
        for update
      loop
        update public.bets set status = 'refunded', payout = v_bet.amount where id = v_bet.id;
        update public.room_members
        set chips = chips + v_bet.amount
        where room_id = v_bet.room_id and user_id = v_bet.user_id
        returning chips into v_new_balance;
        insert into public.chip_ledger (room_id, user_id, bet_id, match_id, type, amount, balance_after, note)
        values (v_bet.room_id, v_bet.user_id, v_bet.id, p_match_id, 'refund', v_bet.amount, v_new_balance, 'No winner in market; principal refunded');
      end loop;
    else
      for v_bet in
        select * from public.bets
        where match_id = p_match_id and market = v_market and status = 'open'
        for update
      loop
        if v_bet.option_key = v_winning_option then
          v_payout := floor((v_pool * v_bet.amount / v_winning_stake) * 100) / 100;
          update public.bets set status = 'won', payout = v_payout where id = v_bet.id;
          update public.room_members
          set chips = chips + v_payout
          where room_id = v_bet.room_id and user_id = v_bet.user_id
          returning chips into v_new_balance;
          insert into public.chip_ledger (room_id, user_id, bet_id, match_id, type, amount, balance_after, note)
          values (v_bet.room_id, v_bet.user_id, v_bet.id, p_match_id, 'settlement', v_payout, v_new_balance, 'Winning market payout');
        else
          update public.bets set status = 'lost', payout = 0 where id = v_bet.id;
        end if;
      end loop;
    end if;
  end loop;

  update public.matches set status = 'settled' where id = p_match_id;
end;
$$;

alter publication supabase_realtime add table public.room_members;
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.bets;
alter publication supabase_realtime add table public.match_results;
alter publication supabase_realtime add table public.chip_ledger;
