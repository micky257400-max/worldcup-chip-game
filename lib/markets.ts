import type { MarketType } from "@/lib/types";

// 7 大盘面的中文翻译
export const marketLabels: Record<string, string> = {
  outcome: "胜平负",
  goal_diff: "净胜球区间",
  total_goals: "总进球区间",
  total_corners: "总角球区间",
  both_teams_score: "双方进球",
  clean_sheet: "出现零封",
  goal_parity: "进球单双"
};

export type MarketOption = {
  key: string;
  label: string;
};

// 完美匹配底层 SQL `settle_match` 的选项 Key
export function getMarketOptions(market: string): MarketOption[] {
  if (market === "outcome") {
    return [
      { key: "HOME", label: "主队胜" },
      { key: "DRAW", label: "平局" },
      { key: "AWAY", label: "客队胜" }
    ];
  }

  if (market === "goal_diff") {
    return [
      { key: "HOME_3_PLUS", label: "主胜 3球及以上" },
      { key: "HOME_2", label: "主胜 2球" },
      { key: "HOME_1", label: "主胜 1球" },
      { key: "DRAW_0", label: "平局 (0球)" },
      { key: "AWAY_1", label: "客胜 1球" },
      { key: "AWAY_2", label: "客胜 2球" },
      { key: "AWAY_3_PLUS", label: "客胜 3球及以上" }
    ];
  }

  if (market === "total_goals") {
    return [
      { key: "GOALS_0_1", label: "0-1 球" },
      { key: "GOALS_2_3", label: "2-3 球" },
      { key: "GOALS_4_5", label: "4-5 球" },
      { key: "GOALS_6_PLUS", label: "6 球及以上" }
    ];
  }

  if (market === "total_corners") {
    return [
      { key: "CORNERS_0_6", label: "0-6 个" },
      { key: "CORNERS_7_9", label: "7-9 个" },
      { key: "CORNERS_10_12", label: "10-12 个" },
      { key: "CORNERS_13_PLUS", label: "13 个及以上" }
    ];
  }

  if (market === "both_teams_score") {
    return [
      { key: "BTTS_YES", label: "是 (双方都有进球)" },
      { key: "BTTS_NO", label: "否" }
    ];
  }

  if (market === "clean_sheet") {
    return [
      { key: "CLEAN_SHEET_YES", label: "是 (一方或双方挂零)" },
      { key: "CLEAN_SHEET_NO", label: "否" }
    ];
  }

  if (market === "goal_parity") {
    return [
      { key: "GOALS_ODD", label: "单数" },
      { key: "GOALS_EVEN", label: "双数" }
    ];
  }

  return [];
}

export function optionLabel(market: string, key: string) {
  return getMarketOptions(market).find((option) => option.key === key)?.label || key;
}