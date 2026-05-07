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
    return date.toLocaleDateString("en-PK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch (e) {
    return isoDate;
  }
};

