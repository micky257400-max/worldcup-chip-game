"use client";

import { Trophy } from "lucide-react";
import { formatChips, formatPercent } from "@/lib/format";
import type { LeaderboardRow } from "@/lib/types";

type Props = {
  rows: LeaderboardRow[];
};

export function StandingsTable({ rows }: Props) {
  const sorted = [...rows].sort((a, b) => Number(b.chips) - Number(a.chips));

  return (
    <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="h-5 w-5 text-pitch" />
        <h2 className="text-lg font-semibold">房间排行榜</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="border-b border-black/10 text-xs text-black/55">
            <tr>
              <th className="py-2 pr-3">排名</th>
              <th className="py-2 pr-3">玩家</th>
              <th className="py-2 pr-3">当前筹码</th>
              <th className="py-2 pr-3">总下注额</th>
              <th className="py-2 pr-3">总盈利</th>
              <th className="py-2 pr-3">命中率</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, index) => (
              <tr key={row.user_id} className="border-b border-black/5 last:border-0">
                <td className="py-3 pr-3 font-semibold">{index + 1}</td>
                <td className="py-3 pr-3">{row.nickname}</td>
                <td className="py-3 pr-3 font-semibold">{formatChips(row.chips)}</td>
                <td className="py-3 pr-3">{formatChips(row.total_wagered)}</td>
                <td className={Number(row.total_profit) >= 0 ? "py-3 pr-3 text-pitch" : "py-3 pr-3 text-red-700"}>
                  {formatChips(row.total_profit)}
                </td>
                <td className="py-3 pr-3">{formatPercent(row.hit_rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
