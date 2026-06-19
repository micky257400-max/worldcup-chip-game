"use client";

import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { Match } from "@/lib/types";

type Props = {
  match: Match;
  onDone: () => void;
};

export function ResultForm({ match, onDone }: Props) {
  const [homeGoals, setHomeGoals] = useState("0");
  const [awayGoals, setAwayGoals] = useState("0");
  const [homeCorners, setHomeCorners] = useState("0");
  const [awayCorners, setAwayCorners] = useState("0");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function settle() {
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await supabase.rpc("settle_match", {
        p_match_id: match.id,
        p_home_goals: Number(homeGoals),
        p_away_goals: Number(awayGoals),
        p_home_corners: Number(homeCorners),
        p_away_corners: Number(awayCorners)
      });
      if (error) throw error;
      setMessage("已结算");
      onDone();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "结算失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-black/10 bg-white p-3">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <ClipboardCheck className="h-4 w-4" />
        录入赛果并结算
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <input value={homeGoals} onChange={(event) => setHomeGoals(event.target.value)} className="h-10 rounded-md border border-black/10 px-3" aria-label="主队进球" />
        <input value={awayGoals} onChange={(event) => setAwayGoals(event.target.value)} className="h-10 rounded-md border border-black/10 px-3" aria-label="客队进球" />
        <input value={homeCorners} onChange={(event) => setHomeCorners(event.target.value)} className="h-10 rounded-md border border-black/10 px-3" aria-label="主队角球" />
        <input value={awayCorners} onChange={(event) => setAwayCorners(event.target.value)} className="h-10 rounded-md border border-black/10 px-3" aria-label="客队角球" />
        <button
          type="button"
          onClick={settle}
          disabled={busy || match.status === "settled"}
          className="h-10 rounded-md bg-pitch px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          {busy ? "结算中" : "结算"}
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-black/50 md:grid-cols-4">
        <span>主队进球</span>
        <span>客队进球</span>
        <span>主队角球</span>
        <span>客队角球</span>
      </div>
      {message ? <p className="mt-2 text-sm text-black/60">{message}</p> : null}
    </div>
  );
}
