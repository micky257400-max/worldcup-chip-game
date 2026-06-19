# 世界杯朋友虚拟筹码竞猜 Web App

一个基于 Next.js、TypeScript、Tailwind CSS、Supabase Postgres、Supabase Realtime 和 Vercel 的朋友房间竞猜应用。应用只使用虚拟筹码，不接真实支付，不涉及真钱。

## 功能

- 玩家加入房间后获得 1000 初始筹码。
- 筹码贯穿整个世界杯，不按单场刷新。
- 比赛日如果玩家筹码低于 300，自动补到 300。
- 每场比赛支持多个市场下注：胜平负、净胜球、总进球数、总角球数。
- 单场总下注不得超过当前筹码加本场已下注额的 30%。
- 比赛开始后自动锁盘。
- 房主录入进球和角球赛果后自动奖池制结算。
- 无人猜中时退回该市场所有本金。
- 所有筹码变化写入 `chip_ledger`。
- 房间排行榜展示昵称、当前筹码、总下注额、总盈利、命中率。
- Supabase Realtime 实时刷新比赛、下注、结算和排行榜。

## 项目结构

```text
.
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   └── rooms/[roomId]/page.tsx
├── components/
│   ├── BetSlip.tsx
│   ├── MatchCard.tsx
│   ├── ResultForm.tsx
│   ├── RoomShell.tsx
│   └── StandingsTable.tsx
├── lib/
│   ├── format.ts
│   ├── markets.ts
│   ├── realtime.ts
│   ├── supabaseClient.ts
│   └── types.ts
├── supabase/
│   ├── rls.sql
│   ├── schema.sql
│   └── seed.sql
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## 本地开发

1. 安装依赖：

```bash
npm install
```

2. 在 Supabase 创建项目，并在 Authentication 设置中开启匿名登录。

3. 打开 Supabase SQL Editor，按顺序执行：

```text
supabase/schema.sql
supabase/rls.sql
```

4. 创建 `.env.local`：

```bash
NEXT_PUBLIC_SUPABASE_URL=你的 Supabase Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的 Supabase anon public key
```

5. 启动：

```bash
npm run dev
```

访问 `http://localhost:3000`。

## Supabase Realtime

`schema.sql` 已将以下表加入 `supabase_realtime` publication：

- `room_members`
- `matches`
- `bets`
- `match_results`
- `chip_ledger`

如果 SQL Editor 提示某张表已加入 publication，可以忽略对应提示，或删除那一行后重跑。

## 核心数据库逻辑

- `create_room_with_member`：创建房间，并给房主初始 1000 筹码。
- `join_room_by_code`：通过房间码加入房间，并发放初始筹码。
- `add_match`：房主添加比赛。
- `place_bet`：下注，校验成员身份、锁盘状态、余额和单场 30% 上限，扣筹码并写流水。
- `lock_due_matches`：将已开赛的比赛自动锁盘。
- `apply_daily_floor`：比赛日低于 300 的玩家补到 300，并写流水。
- `settle_match`：房主录入赛果，按市场奖池结算，并写入派奖/退款流水。

## Vercel 部署

1. 将项目推送到 GitHub。
2. 在 Vercel 导入仓库。
3. 在 Vercel Project Settings → Environment Variables 添加：

```bash
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

4. 部署即可。

## 结算说明

同一场比赛、同一市场的所有下注金额形成奖池。猜中玩家按自己中奖下注额占全部中奖下注额的比例瓜分奖池；派奖金额包含本金。如果该市场无人猜中，则该市场所有下注退回本金。
