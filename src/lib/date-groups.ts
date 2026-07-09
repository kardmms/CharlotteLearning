export function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function dateGroupLabel(date: Date, now = new Date()) {
  const target = startOfDay(date).getTime();
  const today = startOfDay(now).getTime();
  const diffDays = Math.round((today - target) / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return "Earlier this week";

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(date);
}

export function groupByDate<T extends { createdAt: Date }>(items: T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const label = dateGroupLabel(item.createdAt);
    groups.set(label, [...(groups.get(label) || []), item]);
  }
  return Array.from(groups.entries()).map(([label, groupItems]) => ({ label, items: groupItems }));
}
