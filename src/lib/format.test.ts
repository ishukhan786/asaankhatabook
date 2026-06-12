import { formatNumber, formatMoney, balanceLabel, formatDate } from "./format";

describe("format utilities", () => {
  test("formatNumber formats numbers and strings", () => {
    expect(formatNumber(1234)).toBe("1,234");
    expect(formatNumber("5000")).toBe("5,000");
    expect(formatNumber(null)).toBe("0");
    expect(formatNumber(-42.7)).toBe("43");
  });

  test("formatMoney prefixes currency when provided", () => {
    expect(formatMoney(1500, "PKR")).toBe("PKR 1,500");
    expect(formatMoney(0)).toBe("0");
  });

  test("balanceLabel returns CR for >=0 and DR for negative", () => {
    expect(balanceLabel(10)).toBe("CR");
    expect(balanceLabel(0)).toBe("CR");
    expect(balanceLabel(-1)).toBe("DR");
  });

  test("formatDate returns formatted date or N/A", () => {
    expect(formatDate("2023-03-05T00:00:00Z")).toMatch(/05-03-2023/);
    expect(formatDate("")).toBe("N/A");
  });
});
