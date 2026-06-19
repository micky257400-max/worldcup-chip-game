"use client";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function hasSupabaseEnv() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export const supabase = createClient(
  supabaseUrl || "http://localhost:54321",
  supabaseAnonKey || "anon-key-placeholder",
  {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
  }
);

export async function ensureAnonymousUser() {
  const { data: existing } = await supabase.auth.getSession();
  if (existing.session?.user) return existing.session.user;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!data.user) throw new Error("无法创建匿名用户，请确认 Supabase Auth 已开启匿名登录。");
  return data.user;
}
