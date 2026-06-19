alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.matches enable row level security;
alter table public.bets enable row level security;
alter table public.match_results enable row level security;
alter table public.chip_ledger enable row level security;
alter table public.daily_floor_grants enable row level security;

create policy "rooms visible to members"
on public.rooms for select
using (owner_id = auth.uid() or public.is_room_member(id));

create policy "members can see room members"
on public.room_members for select
using (public.is_room_member(room_id));

create policy "members can update own nickname"
on public.room_members for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "members can see matches"
on public.matches for select
using (public.is_room_member(room_id));

create policy "owners can update matches"
on public.matches for update
using (public.is_room_owner(room_id))
with check (public.is_room_owner(room_id));

create policy "members can see bets in room"
on public.bets for select
using (public.is_room_member(room_id));

create policy "members can see results"
on public.match_results for select
using (public.is_room_member(room_id));

create policy "members can see ledgers"
on public.chip_ledger for select
using (public.is_room_member(room_id));

create policy "members can see floor grants"
on public.daily_floor_grants for select
using (public.is_room_member(room_id));

grant usage on schema public to anon, authenticated;
grant select on public.room_leaderboard to authenticated;
grant select on public.rooms, public.room_members, public.matches, public.bets, public.match_results, public.chip_ledger, public.daily_floor_grants to authenticated;
grant execute on function public.create_room_with_member(text, text) to authenticated;
grant execute on function public.join_room_by_code(text, text) to authenticated;
grant execute on function public.is_room_member(uuid) to authenticated;
grant execute on function public.is_room_owner(uuid) to authenticated;
grant execute on function public.add_match(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.place_bet(uuid, uuid, public.market_type, text, numeric) to authenticated;
grant execute on function public.lock_due_matches(uuid) to authenticated;
grant execute on function public.apply_daily_floor(uuid) to authenticated;
grant execute on function public.settle_match(uuid, integer, integer, integer, integer) to authenticated;
