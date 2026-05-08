export const formatNumber = (n: any) => {
  const num = Number(n) || 0;
  return Math.abs(num).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatMoney = (n: any, currency: string = "") => {
  const v = formatNumber(n);
  return currency ? `${currency} ${v}` : v;
};

export const balanceLabel = (n: number) => (n >= 0 ? "CR" : "DR");

export const formatDate = (isoDate: string) => {
  if (!isoDate) return "—";
  try {
    const date = new Date(isoDate);
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
  } catch (e) {
    return isoDate;
  }
};

