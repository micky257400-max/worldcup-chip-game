"use client";

import { Trophy } from "lucide-react";
import { formatChips, formatPercent } from "@/lib/format";
import type { LeaderboardRow, Room } from "@/lib/types";

type Props = {
  rows: LeaderboardRow[];
  // 接收传进来的 room 状态
  room?: Room | null;
};

export function StandingsTable({ rows, room }: Props) {
  // 按照筹码数从高到低排序
  const sorted = [...rows].sort((a, b) => Number(b.chips) - Number(a.chips));
  
  // 判断是否已封榜
  const isFinalized = Boolean(room?.finalized_at);

  // 结算荣誉称号的数据结构
  const titles: Record<string, { label: string; icon: string; style: string }[]> = {};

  if (isFinalized && sorted.length > 0) {
    // 找出各项指标的极值
    const maxChipsId = sorted[0].user_id; // 筹码最多
    
    const maxWagered = Math.max(...rows.map((r) => Number(r.total_wagered)));
    const maxWageredId = rows.find((r) => Number(r.total_wagered) === maxWagered)?.user_id;

    const minProfit = Math.min(...rows.map((r) => Number(r.total_profit)));
    const minProfitId = rows.find((r) => Number(r.total_profit) === minProfit)?.user_id;

    const maxHitRate = Math.max(...rows.map((r) => Number(r.hit_rate)));
    const maxHitRateId = rows.find((r) => Number(r.hit_rate) === maxHitRate)?.user_id;

    // 为每个玩家初始化称号数组
    rows.forEach((row) => (titles[row.user_id] = []));

    // 颁发称号（加上各种醒目的 Tailwind 颜色）
    if (maxChipsId) {
      titles[maxChipsId].push({ label: "总冠军", icon: "🏆", style: "bg-yellow-100 text-yellow-800 border-yellow-300" });
    }
    if (maxHitRateId && maxHitRate > 0) {
      titles[maxHitRateId].push({ label: "神射手", icon: "🎯", style: "bg-green-100 text-green-800 border-green-300" });
    }
    if (maxWageredId && maxWagered > 0) {
      titles[maxWageredId].push({ label: "梭哈战神", icon: "🔥", style: "bg-red-100 text-red-800 border-red-300" });
    }
    if (minProfitId && minProfit < 0) {
      titles[minProfitId].push({ label: "反向明灯", icon: "💡", style: "bg-slate-100 text-slate-700 border-slate-300" });
    }
  }

  return (
    <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="h-5 w-5 text-pitch" />
        <h2 className="text-lg font-semibold">{isFinalized ? "赛季最终荣誉榜" : "房间排行榜"}</h2>
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
                <td className="py-3 pr-3 font-semibold">
                  {index === 0 && isFinalized ? <span className="text-xl">👑</span> : index + 1}
                </td>
                <td className="py-3 pr-3">
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-medium">{row.nickname}</span>
                    {/* 如果有称号，渲染在这里 */}
                    {titles[row.user_id]?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {titles[row.user_id].map((t) => (
                          <span key={t.label} className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${t.style}`}>
                            {t.icon} {t.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td className={`py-3 pr-3 font-semibold ${isFinalized && index === 0 ? "text-yellow-600 text-base" : ""}`}>
                  {formatChips(row.chips)}
                </td>
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