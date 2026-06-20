"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogIn, PlusCircle, ArrowRight } from "lucide-react";
import { ensureAnonymousUser, hasSupabaseEnv, supabase } from "@/lib/supabaseClient";

export default function HomePage() {
  const router = useRouter();
  const [roomName, setRoomName] = useState("世界杯朋友局");
  const [nickname, setNickname] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | "resume" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  
  // 新增：用于记录上次进入的房间 ID
  const [lastRoomId, setLastRoomId] = useState<string | null>(null);

  // 页面加载时，尝试读取本地缓存的昵称和房间记录
  useEffect(() => {
    const savedNickname = localStorage.getItem("wc_nickname");
    const savedRoomId = localStorage.getItem("wc_last_room");
    
    if (savedNickname) setNickname(savedNickname);
    if (savedRoomId) setLastRoomId(savedRoomId);

    // 顺便检查一下 Supabase 的登录状态是否还在，如果失效了就清空房间记录
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        localStorage.removeItem("wc_last_room");
        setLastRoomId(null);
      }
    });
  }, []);

  // 辅助函数：成功进入房间后，把信息存到本地
  const saveToLocal = (name: string, roomId: string) => {
    localStorage.setItem("wc_nickname", name);
    localStorage.setItem("wc_last_room", roomId);
  };

  async function createRoom() {
    setBusy("create");
    setMessage(null);
    try {
      if (!hasSupabaseEnv()) throw new Error("请先配置 Supabase 环境变量。");
      if (!nickname.trim()) throw new Error("请输入昵称。");
      await ensureAnonymousUser();
      
      const { data, error } = await supabase.rpc("create_room_with_member", {
        p_name: roomName,
        p_nickname: nickname
      });
      if (error) throw error;
      
      saveToLocal(nickname, data); // 保存记录
      router.push(`/rooms/${data}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建房间失败");
    } finally {
      setBusy(null);
    }
  }

  async function joinRoom() {
    setBusy("join");
    setMessage(null);
    try {
      if (!hasSupabaseEnv()) throw new Error("请先配置 Supabase 环境变量。");
      if (!nickname.trim() || !joinCode.trim()) throw new Error("请输入昵称和房间码。");
      await ensureAnonymousUser();
      
      const { data, error } = await supabase.rpc("join_room_by_code", {
        p_code: joinCode,
        p_nickname: nickname
      });
      if (error) throw error;
      
      saveToLocal(nickname, data); // 保存记录
      router.push(`/rooms/${data}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加入房间失败");
    } finally {
      setBusy(null);
    }
  }

  // 新增：一键恢复上次房间的方法
  function resumeLastRoom() {
    if (lastRoomId) {
      setBusy("resume");
      router.push(`/rooms/${lastRoomId}`);
    }
  }

  return (
    <main className="min-h-screen bg-paper">
      <section className="mx-auto grid min-h-screen max-w-5xl content-center gap-8 px-4 py-10 md:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col justify-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-pitch">Virtual Chips Pool</p>
          <h1 className="max-w-xl text-4xl font-bold leading-tight md:text-6xl">世界杯朋友虚拟筹码竞猜</h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-black/65">
            每人 1000 初始筹码，单场下注上限 30%，按市场奖池结算。没有真钱，只有朋友间的判断力和一点点运气。
          </p>
        </div>

        <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
          
          {/* 新增 UI：如果检测到上次的房间，显示醒目的继续按钮 */}
          {lastRoomId && (
            <div className="mb-6 rounded-md border border-pitch/20 bg-pitch/5 p-4">
              <p className="mb-3 text-sm font-medium text-pitch">欢迎回来，{nickname || "朋友"}</p>
              <button
                type="button"
                onClick={resumeLastRoom}
                disabled={busy !== null}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-pitch px-4 font-semibold text-white disabled:opacity-50"
              >
                {busy === "resume" ? "进入中..." : "继续上次的房间"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          <label className="mb-2 block text-sm font-medium">昵称</label>
          <input
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="例如 小李"
            className="mb-4 h-11 w-full rounded-md border border-black/10 px-3"
          />

          <label className="mb-2 block text-sm font-medium">新房间名称</label>
          <input
            value={roomName}
            onChange={(event) => setRoomName(event.target.value)}
            className="mb-3 h-11 w-full rounded-md border border-black/10 px-3"
          />
          <button
            type="button"
            onClick={createRoom}
            disabled={busy !== null}
            className="mb-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-pitch px-4 font-semibold text-white disabled:opacity-50"
          >
            <PlusCircle className="h-4 w-4" />
            {busy === "create" ? "创建中..." : "创建新房间"}
          </button>

          <label className="mb-2 block text-sm font-medium">加入已有房间</label>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              placeholder="房间码"
              className="h-11 rounded-md border border-black/10 px-3"
            />
            <button
              type="button"
              onClick={joinRoom}
              disabled={busy !== null}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-limewash px-4 font-semibold text-ink disabled:opacity-50"
            >
              <LogIn className="h-4 w-4" />
              {busy === "join" ? "加入中..." : "加入房间"}
            </button>
          </div>

          {message ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{message}</p> : null}
        </div>
      </section>
    </main>
  );
}