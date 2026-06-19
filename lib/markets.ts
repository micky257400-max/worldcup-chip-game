import type { MarketType } from "@/lib/types";

export const marketLabels: Record<MarketType, string> = {
  outcome: "胜平负",
  goal_diff: "净胜球",
  total_goals: "总进球数",
  total_corners: "总角球数"
};

export type MarketOption = {
  key: string;
  label: string;
};

export function getMarketOptions(market: MarketType): MarketOption[] {
  if (market === "outcome") {
    return [
      { key: "HOME", label: "主胜" },
      { key: "DRAW", label: "平局" },
      { key: "AWAY", label: "客胜" }
    ];
  }

  if (market === "goal_diff") {
    return Array.from({ length: 11 }, (_, index) => {
      const value = index - 5;
      return { key: String(value), label: value > 0 ? `主 +${value}` : value < 0 ? `客 +${Math.abs(value)}` : "打平 0" };
    });
  }

  if (market === "total_goals") {
    return Array.from({ length: 11 }, (_, value) => ({ key: String(value), label: `${value} 球` }));
  }

  return Array.from({ length: 21 }, (_, value) => ({ key: String(value), label: `${value} 个` }));
}

export function optionLabel(market: MarketType, key: string) {
  return getMarketOptions(market).find((option) => option.key === key)?.label || key;
}
