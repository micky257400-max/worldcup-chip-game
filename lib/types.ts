export type MarketType = "outcome" | "goal_diff" | "total_goals" | "total_corners";
export type MatchStatus = "scheduled" | "locked" | "settled";
export type BetStatus = "open" | "won" | "lost" | "refunded";

export type Room = {
  id: string;
  code: string;
  name: string;
  owner_id: string;
  created_at: string;
};

export type RoomMember = {
  id: string;
  room_id: string;
  user_id: string;
  nickname: string;
  chips: number;
  created_at: string;
};

export type Match = {
  id: string;
  room_id: string;
  home_team: string;
  away_team: string;
  starts_at: string;
  status: MatchStatus;
  created_by: string;
  created_at: string;
};

export type Bet = {
  id: string;
  room_id: string;
  match_id: string;
  user_id: string;
  market: MarketType;
  option_key: string;
  amount: number;
  payout: number | null;
  status: BetStatus;
  created_at: string;
};

export type MatchResult = {
  match_id: string;
  room_id: string;
  home_goals: number;
  away_goals: number;
  home_corners: number;
  away_corners: number;
  entered_by: string;
  created_at: string;
};

export type LeaderboardRow = {
  room_id: string;
  user_id: string;
  nickname: string;
  chips: number;
  total_wagered: number;
  total_profit: number;
  hit_rate: number;
};
