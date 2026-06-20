"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
// 新增了 Trophy, Lock, AlertTriangle 等图标
import { Plus, RefreshCw, Trophy, Lock, AlertTriangle } from "lucide-react";
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
  
  // 比赛录入状态
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [startsAt, setStartsAt] = useState("");

  // 新增：房主赛季管理状态
  const [seasonEndDate, setSeasonEndDate] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  const isOwner = Boolean(room && userId && room.owner_id === userId);
  
  // 新增：判断是否已封榜
  const isFinalized = Boolean(room?.finalized_at);

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
    if (isFinalized) {
      setMessage("房间已封榜，无法再添加比赛。");
      return;
    }
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

  // 新增：设置赛季截止时间
  async function handleSetSeasonEnd() {
    setMessage(null);
    if (!seasonEndDate) {
      setMessage("请选择截止时间");
      return;
    }
    setActionBusy(true);
    try {
      const { error } = await supabase.rpc("set_room_season_end", {
        p_room_id: roomId,
        p_season_ends_at: new Date(seasonEndDate).toISOString()
      });
      if (error) throw error;
      setMessage("✅ 赛季截止时间已成功设置");
      setSeasonEndDate("");
      loadRoom();
    } catch (error: any) {
      setMessage(error?.message || "设置截止时间失败");
    } finally {
      setActionBusy(false);
    }
  }

  // 新增：执行封榜操作
  async function handleFinalize() {
    if (!confirm("⚠️ 确定要封榜吗？\n\n封榜后将无法再添加比赛、下注或结算，系统将锁定当前排行榜。此操作不可逆！")) return;
    
    setMessage(null);
    setActionBusy(true);
    try {
      const { error } = await supabase.rpc("finalize_room", {
        p_room_id: roomId
      });
      if (error) throw error;
      setMessage("🎉 房间已成功封榜！");
      loadRoom();
    } catch (error: any) {
      setMessage(error?.message || "封榜失败");
    } finally {
      setActionBusy(false);
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

      {/* 新增：如果已封榜，展示全屏炫酷横幅 */}
      {isFinalized ? (
        <div className="mb-8 rounded-xl bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 px-6 py-10 text-center text-white shadow-lg">
          <Trophy className="mx-auto mb-4 h-16 w-16 drop-shadow-md" />
          <h2 className="text-4xl font-extrabold tracking-tight drop-shadow-sm">赛季已封榜</h2>
          <p className="mt-3 text-lg font-medium text-yellow-50">本房间竞猜已圆满结束，买定离手，快去看看谁是真正的懂球帝！</p>
          <p className="mt-1 text-sm text-yellow-100 opacity-80">封榜时间: {new Date(room!.finalized_at!).toLocaleString()}</p>
        </div>
      ) : null}

      {/* 仅未封榜且是房主时，展示操作台 */}
      {!isFinalized && isOwner ? (
        <section className="mb-8 space-y-5 rounded-lg border border-black/10 bg-white p-5 shadow-sm">
          {/* 上半部分：添加比赛 */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Plus className="h-5 w-5 text-pitch" />
              <h2 className="text-lg font-semibold">添加比赛</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_220px_auto]">
              <input value={homeTeam} onChange={(event) => setHomeTeam(event.target.value)} placeholder="主队" className="h-10 rounded-md border border-black/10 px-3" />
              <input value={awayTeam} onChange={(event) => setAwayTeam(event.target.value)} placeholder="客队" className="h-10 rounded-md border border-black/10 px-3" />
              <input value={startsAt} onChange={(event) => setStartsAt(event.target.value)} type="datetime-local" className="h-10 rounded-md border border-black/10 px-3" />
              <button type="button" onClick={addMatch} className="h-10 rounded-md bg-limewash px-4 text-sm font-semibold text-ink hover:brightness-95">
                添加
              </button>
            </div>
          </div>

          <hr className="border-black/5" />

          {/* 下半部分：新增的赛季与封榜控制 */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-pitch" />
                <h2 className="text-lg font-semibold">赛季管理</h2>
              </div>
              {room?.season_ends_at && (
                <span className="rounded bg-black/5 px-2 py-1 text-xs font-medium text-black/60">
                  当前设定的截止时间: {new Date(room.season_ends_at).toLocaleString()}
                </span>
              )}
            </div>
            
            <div className="grid gap-3 md:grid-cols-[220px_auto_1fr_auto]">
              <input 
                value={seasonEndDate} 
                onChange={(event) => setSeasonEndDate(event.target.value)} 
                type="datetime-local" 
                className="h-10 rounded-md border border-black/10 px-3" 
              />
              <button 
                type="button" 
                onClick={handleSetSeasonEnd} 
                disabled={actionBusy}
                className="h-10 rounded-md bg-pitch px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                设置截止时间
              </button>
              
              <div className="hidden md:block"></div> {/* 占位符 */}
              
              <button 
                type="button" 
                onClick={handleFinalize} 
                disabled={actionBusy || !room?.season_ends_at}
                className="h-10 rounded-md bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                title={!room?.season_ends_at ? "请先设置截止时间" : ""}
              >
                结束赛季并封榜
              </button>
            </div>
            
            {!room?.season_ends_at && (
              <p className="mt-3 flex items-center gap-1 text-xs text-red-500">
                <AlertTriangle className="h-4 w-4" />
                提示：必须先设置并到达截止时间，且所有比赛结算完毕后，才能执行封榜操作。
              </p>
            )}
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-4">
          {matches.length === 0 ? (
            <div className="rounded-lg border border-black/10 bg-white p-8 text-center text-black/55">
              {isFinalized ? "赛季已结束，本次房间没有比赛记录。" : "房主添加比赛后即可开始下注。"}
            </div>
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
                // 注意这里：我偷偷把 room 状态传进去了，方便一会儿我们在子组件里判断是否封榜
                room={room} 
              />
            ))
          )}
        </section>
        <StandingsTable rows={leaderboard} room={room} />
      </div>
    </main>
  );
}