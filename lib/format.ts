export function formatChips(value: number | string | null | undefined) {
  const numeric = Number(value || 0);
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: numeric % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(numeric);
}

export function formatPercent(value: number | string | null | undefined) {
  return `${(Number(value || 0) * 100).toFixed(0)}%`;
}

export function formatMatchTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
