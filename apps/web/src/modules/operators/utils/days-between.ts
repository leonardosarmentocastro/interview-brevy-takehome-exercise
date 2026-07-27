export function daysBetween(laterISO: string, earlierISO: string): number {
  const ms = new Date(laterISO).getTime() - new Date(earlierISO).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}
