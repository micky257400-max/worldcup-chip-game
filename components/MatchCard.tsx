"use client";

import { CalendarClock } from "lucide-react";
import { formatChips, formatMatchTime } from "@/lib/format";
import { marketLabels, optionLabel } from "@/lib/markets";
import type { Bet, Match, MatchResult, RoomMember } from "@/lib/types";
import { BetSlip } from "@/components/BetSlip";
import { ResultForm } from "@/components/ResultForm";

type Props = {
  roomId: string;
  match: Match;
  member: RoomMember | null;
  myBets: Bet[];
  allBets: Bet[];
  result?: MatchResult;
  isOwner: boolean;
  onChanged: () => void;
};

const statusLabels = {
  scheduled: "可下注",
  locked: "已锁盘",
  settled: "已结算"
};

export function MatchCard({ roomId, match, member, myBets, allBets, result, isOwner, onChanged }: Props) {
  const pools = allBets
    .filter((bet) => bet.match_id === match.id)
    .reduce<Record<string, number>>((acc, bet) => {
      const key = `${bet.market}:${bet.option_key}`;
      acc[key] = (acc[key] || 0) + Number(bet.amount);
      return acc;
    }, {});

  return (
    <article className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-black/55">
            <CalendarClock className="h-4 w-4" />
            {formatMatchTime(match.starts_at)}
          </div>
          <h3 className="mt-1 text-xl font-semibold">
            {match.home_team} <span className="text-black/35">vs</span> {match.away_team}
          </h3>
        </div>
        <span className="rounded-full bg-black/5 px-3 py-1 text-sm font-medium">{statusLabels[match.status]}</span>
      </div>

      {result ? (
        <div className="mt-3 rounded-md bg-pitch px-3 py-2 text-sm text-white">
          赛果 {result.home_goals}-{result.away_goals}，角球 {result.home_corners}-{result.away_corners}
        </div>
      ) : null}

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {Object.entries(pools).slice(0, 8).map(([key, amount]) => {
          const [market, option] = key.split(":");
          return (
            <div key={key} className="rounded-md bg-paper px-3 py-2 text-sm">
              <span className="font-medium">{marketLabels[market as keyof typeof marketLabels]}</span>
              <span className="mx-1 text-black/35">/</span>
              <span>{optionLabel(market as keyof typeof marketLabels, option)}</span>
              <span className="float-right font-semibold">{formatChips(amount)}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <BetSlip roomId={roomId} match={match} member={member} myBets={myBets} onDone={onChanged} />
      </div>

      {myBets.length > 0 ? (
        <div className="mt-3 text-sm text-black/60">
          我的本场下注：
          {myBets.map((bet) => (
            <span key={bet.id} className="ml-2 inline-block rounded-full bg-black/5 px-2 py-1">
              {marketLabels[bet.market]} {optionLabel(bet.market, bet.option_key)} {formatChips(bet.amount)}
            </span>
          ))}
        </div>
      ) : null}

      {isOwner && match.status !== "settled" ? <ResultForm match={match} onDone={onChanged} /> : null}
    </article>
  );
}
