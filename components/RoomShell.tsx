"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Bet, LeaderboardRow, Match, MatchResult, Room, RoomMember } from "@/lib/types";
import { ensureAnonymousUser, hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import { subscribeToRoom } from "@/lib/realtime";
import { formatChips } from "@/lib/format";
import { MatchCard } from "@/components/MatchCard";
import { StandingsTable } from "@/components/StandingsTable";

type Props = {
  roomId: string;
};

export function RoomShell({ roomId }: Props) {
  const [userId, setUserId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [member, setMember] = useState<RoomMember | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [startsAt, setStartsAt] = useState("");

  const isOwner = Boolean(room && userId && room.owner_id === userId);

  const loadRoom = useCallback(async () => {
    if (!hasSupabaseEnv()) {
      setMessage("请先配置 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY。");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const user = await ensureAnonymousUser();
      setUserId(user.id);
      await supabase.rpc("lock_due_matches", { p_room_id: roomId });
      await supabase.rpc("apply_daily_floor", { p_room_id: roomId });

      const [roomRes, memberRes, matchesRes, betsRes, resultsRes, leaderboardRes] = await Promise.all([
        supabase.from("rooms").select("*").eq("id", roomId).single(),
        supabase.from("room_members").select("*").eq("room_id", roomId).eq("user_id", user.id).single(),
        supabase.from("matches").select("*").eq("room_id", roomId).order("starts_at", { ascending: true }),
        supabase.from("bets").select("*").eq("room_id", roomId).order("created_at", { ascending: false }),
        supabase.from("match_results").select("*").eq("room_id", roomId),
        supabase.from("room_leaderboard").select("*").eq("room_id", roomId)
      ]);

      if (roomRes.error) throw roomRes.error;
      if (memberRes.error) throw memberRes.error;
      if (matchesRes.error) throw matchesRes.error;
      if (betsRes.error) throw betsRes.error;
      if (resultsRes.error) throw resultsRes.error;
      if (leaderboardRes.error) throw leaderboardRes.error;

      setRoom(roomRes.data as Room);
      setMember(memberRes.data as RoomMember);
      setMatches((matchesRes.data || []) as Match[]);
      setBets((betsRes.data || []) as Bet[]);
      setResults((resultsRes.data || []) as MatchResult[]);
      setLeaderboard((leaderboardRes.data || []) as LeaderboardRow[]);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载房间失败");
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  useEffect(() => {
    if (!roomId || !hasSupabaseEnv()) return;
    const channel = subscribeToRoom(roomId, loadRoom);
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadRoom, roomId]);

  const myBetsByMatch = useMemo(() => {
    return bets
      .filter((bet) => bet.user_id === userId)
      .reduce<Record<string, Bet[]>>((acc, bet) => {
        acc[bet.match_id] = acc[bet.match_id] || [];
        acc[bet.match_id].push(bet);
        return acc;
      }, {});
  }, [bets, userId]);

  async function addMatch() {
    setMessage(null);
    try {
      if (!homeTeam.trim() || !awayTeam.trim() || !startsAt) throw new Error("请填写完整比赛信息。");
      const { error } = await supabase.rpc("add_match", {
        p_room_id: roomId,
        p_home_team: homeTeam,
        p_away_team: awayTeam,
        p_starts_at: new Date(startsAt).toISOString()
      });
      if (error) throw error;
      setHomeTeam("");
      setAwayTeam("");
      setStartsAt("");
      loadRoom();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "添加比赛失败");
    }
  }

  if (loading && !room) {
    return <main className="mx-auto max-w-6xl px-4 py-10">加载中...</main>;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-black/55">房间码 {room?.code}</p>
          <h1 className="text-3xl font-bold">{room?.name || "竞猜房间"}</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-black/10 bg-white px-4 py-2">
            <p className="text-xs text-black/50">我的筹码</p>
            <p className="text-xl font-semibold">{formatChips(member?.chips)}</p>
          </div>
          <button type="button" onClick={loadRoom} className="inline-flex h-11 items-center gap-2 rounded-md bg-pitch px-4 text-sm font-semibold text-white">
            <RefreshCw className="h-4 w-4" />
            刷新
          </button>
        </div>
      </header>

      {message ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{message}</div> : null}

      {isOwner ? (
        <section className="mb-6 rounded-lg border border-black/10 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Plus className="h-5 w-5 text-pitch" />
            <h2 className="text-lg font-semibold">添加比赛</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_220px_auto]">
            <input value={homeTeam} onChange={(event) => setHomeTeam(event.target.value)} placeholder="主队" className="h-10 rounded-md border border-black/10 px-3" />
            <input value={awayTeam} onChange={(event) => setAwayTeam(event.target.value)} placeholder="客队" className="h-10 rounded-md border border-black/10 px-3" />
            <input value={startsAt} onChange={(event) => setStartsAt(event.target.value)} type="datetime-local" className="h-10 rounded-md border border-black/10 px-3" />
            <button type="button" onClick={addMatch} className="h-10 rounded-md bg-limewash px-4 text-sm font-semibold text-ink">
              添加
            </button>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-4">
          {matches.length === 0 ? (
            <div className="rounded-lg border border-black/10 bg-white p-8 text-center text-black/55">房主添加比赛后即可开始下注。</div>
          ) : (
            matches.map((match) => (
              <MatchCard
                key={match.id}
                roomId={roomId}
                match={match}
                member={member}
                myBets={myBetsByMatch[match.id] || []}
                allBets={bets}
                result={results.find((result) => result.match_id === match.id)}
                isOwner={isOwner}
                onChanged={loadRoom}
              />
            ))
          )}
        </section>
        <StandingsTable rows={leaderboard} />
      </div>
    </main>
  );
}
