"use client";

import { useMemo, useState } from "react";
import { Coins } from "lucide-react";
import { formatChips } from "@/lib/format";
import { getMarketOptions, marketLabels } from "@/lib/markets";
import { supabase } from "@/lib/supabaseClient";
import type { Bet, MarketType, Match, RoomMember } from "@/lib/types";

type Props = {
  roomId: string;
  match: Match;
  member: RoomMember | null;
  myBets: Bet[];
  onDone: () => void;
};

// 全面扩展为 7 大盘面
const markets = [
  "outcome",
  "goal_diff",
  "total_goals",
  "total_corners",
  "both_teams_score",
  "clean_sheet",
  "goal_parity"
];

export function BetSlip({ roomId, match, member, myBets, onDone }: Props) {
  const [market, setMarket] = useState("outcome");
  const [optionKey, setOptionKey] = useState("HOME");
  const [amount, setAmount] = useState("50");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isLocked = match.status !== "scheduled" || new Date(match.starts_at).getTime() <= Date.now();
  const existingStake = useMemo(() => myBets.reduce((sum, bet) => sum + Number(bet.amount), 0), [myBets]);
  const cap = member ? Math.floor((Number(member.chips) + existingStake) * 0.3 * 100) / 100 : 0;
  const remainingCap = Math.max(0, cap - existingStake);

  const options = getMarketOptions(market);

  async function submitBet() {
    setBusy(true);
    setMessage(null);
    try {
      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) throw new Error("请输入有效下注额。");

      const { error } = await supabase.rpc("place_bet", {
        p_room_id: roomId,
        p_match_id: match.id,
        p_market: market as MarketType, // 强制断言转换，绕开旧版类型的检查
        p_option_key: optionKey,
        p_amount: parsedAmount
      });

      if (error) throw error;
      setMessage("✅ 下注成功！");
      onDone();
    } catch (error: any) {
      setMessage(error?.message || "下注失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-black/10 bg-paper p-3">
      <div className="mb-3 flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-1 font-medium">
          <Coins className="h-4 w-4" />
          本场可再下
        </span>
        <span className="font-semibold">{formatChips(remainingCap)}</span>
      </div>

      {/* 调整了布局方式，让 7 个按钮自动换行并适配移动端屏幕 */}
      <div className="flex flex-wrap gap-2">
        {markets.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setMarket(item);
              setOptionKey(getMarketOptions(item)[0].key);
            }}
            className={`h-9 rounded-md border px-3 text-sm font-medium transition-colors ${
              market === item ? "border-pitch bg-pitch text-white" : "border-black/10 bg-white hover:border-pitch hover:bg-black/5"
            }`}
          >
            {marketLabels[item]}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_120px_auto]">
        <select
          value={optionKey}
          onChange={(event) => setOptionKey(event.target.value)}
          className="h-10 rounded-md border border-black/10 bg-white px-3"
          disabled={isLocked}
        >
          {options.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          className="h-10 rounded-md border border-black/10 bg-white px-3 font-semibold"
          disabled={isLocked}
        />
        <button
          type="button"
          onClick={submitBet}
          disabled={busy || isLocked}
          className="h-10 rounded-md bg-limewash px-4 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-45"
        >
          {busy ? "提交中..." : isLocked ? "已锁盘" : "下注"}
        </button>
      </div>

      {message ? <p className="mt-2 text-sm text-black/60">{message}</p> : null}
    </div>
  );
}