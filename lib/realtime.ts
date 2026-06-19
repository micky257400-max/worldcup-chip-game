"use client";

import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

export function subscribeToRoom(roomId: string, onChange: () => void): RealtimeChannel {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const refresh = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(onChange, 150);
  };

  return supabase
    .channel(`room:${roomId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` }, refresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `room_id=eq.${roomId}` }, refresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "bets", filter: `room_id=eq.${roomId}` }, refresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "match_results", filter: `room_id=eq.${roomId}` }, refresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "chip_ledger", filter: `room_id=eq.${roomId}` }, refresh)
    .subscribe();
}
