export function formatMoney(n: number): string {
  return "$" + Number(n).toFixed(2);
}
