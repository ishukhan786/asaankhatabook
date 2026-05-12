import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatMoney, balanceLabel, formatDate } from "./format";

export type BusinessInfo = {
  business_name?: string | null;
  business_phone?: string | null;
  business_address?: string | null;
};

const rgb = (color: [number, number, number]) => color;

export function exportStatementPDF(account: any, rows: any[], businessInfo?: BusinessInfo | null) {
  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  const primaryColor: [number, number, number] = [20, 47, 77];
  const accentColor: [number, number, number] = [218, 164, 44];
  const inkColor: [number, number, number] = [31, 41, 55];
  const mutedColor: [number, number, number] = [100, 116, 139];
  const dangerColor: [number, number, number] = [180, 30, 30];
  const successColor: [number, number, number] = [22, 101, 52];

  const businessName = businessInfo?.business_name?.trim() || "AsaanKhata";
  const businessLines = [
    businessInfo?.business_address,
    businessInfo?.business_phone ? `Contact: ${businessInfo.business_phone}` : "",
  ].filter((line): line is string => Boolean(line?.trim()));
  const generatedAt = new Date().toLocaleString();

  doc.setFillColor(...rgb(primaryColor));
  doc.rect(0, 0, W, 48, "F");
  doc.setFillColor(...rgb(accentColor));
  doc.rect(0, 46, W, 2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(businessName, 12, 16, { maxWidth: 112 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  let headerLineY = 24;
  const headerBusinessLines = businessLines.length ? businessLines : ["Professional Digital Ledger Solution"];
  headerBusinessLines.slice(0, 3).forEach((line) => {
    doc.splitTextToSize(line, 116).slice(0, 2).forEach((part: string) => {
      doc.text(part, 12, headerLineY);
      headerLineY += 4.2;
    });
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("ACCOUNT STATEMENT", W - 12, 16, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Generated: ${generatedAt}`, W - 12, 24, { align: "right" });
  doc.text(`Account: ${account.account_no}`, W - 12, 30, { align: "right" });

  const accountBoxX = 10;
  const accountBoxY = 58;
  const accountBoxW = 112;
  const accountBoxH = 54;
  const summaryBoxWidth = 76;
  const summaryBoxX = W - summaryBoxWidth - 10;
  const summaryBoxY = 58;
  const summaryBoxH = 50;

  doc.setFillColor(249, 250, 251);
  doc.roundedRect(accountBoxX, accountBoxY, accountBoxW, accountBoxH, 3, 3, "F");
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(accountBoxX, accountBoxY, accountBoxW, accountBoxH, 3, 3, "D");

  doc.setFillColor(...rgb(primaryColor));
  doc.roundedRect(accountBoxX, accountBoxY, accountBoxW, 12, 3, 3, "F");
  doc.setFillColor(...rgb(primaryColor));
  doc.rect(accountBoxX, accountBoxY + 8, accountBoxW, 4, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("ACCOUNT HOLDER DETAILS", accountBoxX + accountBoxW / 2, 66, { align: "center" });

  const detailLabel = (label: string, value: string, x: number, y: number, maxWidth = 44) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...rgb(mutedColor));
    doc.text(label.toUpperCase(), x, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.8);
    doc.setTextColor(...rgb(inkColor));
    doc.text(value || "-", x, y + 4.5, { maxWidth });
  };

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...rgb(primaryColor));
  doc.text(String(account.name || "-").toUpperCase(), 18, 78, { maxWidth: 94 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const col1 = 18;
  const col2 = 68;
  detailLabel("Account No", account.account_no, col1, 88, 45);
  detailLabel("Mobile No", account.mobile, col2, 88, 45);
  detailLabel("Currency", account.currency, col1, 99, 45);
  detailLabel("Address", account.address, col2, 99, 45);

  const totalDebit = rows.reduce((s, r) => s + Number(r.debit), 0);
  const totalCredit = rows.reduce((s, r) => s + Number(r.credit), 0);
  const net = totalCredit - totalDebit;
  const fmtInt = (n: number) => Math.round(Math.abs(n)).toLocaleString();

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(summaryBoxX, summaryBoxY, summaryBoxWidth, summaryBoxH, 3, 3, "F");
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(summaryBoxX, summaryBoxY, summaryBoxWidth, summaryBoxH, 3, 3, "D");

  doc.setFillColor(245, 248, 255);
  doc.roundedRect(summaryBoxX, summaryBoxY, summaryBoxWidth, 12, 3, 3, "F");
  doc.setFillColor(245, 248, 255);
  doc.rect(summaryBoxX, summaryBoxY + 8, summaryBoxWidth, 4, "F");
  doc.setDrawColor(...rgb(accentColor));
  doc.setLineWidth(0.8);
  doc.line(summaryBoxX, summaryBoxY + 12, summaryBoxX + summaryBoxWidth, summaryBoxY + 12);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...rgb(primaryColor));
  doc.text("STATEMENT SUMMARY", summaryBoxX + summaryBoxWidth / 2, 66, { align: "center" });

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...rgb(mutedColor));
  doc.text("Total Credit", summaryBoxX + 6, 78);
  doc.setTextColor(...rgb(successColor));
  doc.text(`${account.currency} ${fmtInt(totalCredit)}`, W - 16, 78, { align: "right" });

  doc.setTextColor(...rgb(mutedColor));
  doc.text("Total Debit", summaryBoxX + 6, 86);
  doc.setTextColor(...rgb(dangerColor));
  doc.text(`${account.currency} ${fmtInt(totalDebit)}`, W - 16, 86, { align: "right" });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.1);
  doc.line(summaryBoxX + 6, 92, W - 16, 92);

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...rgb(primaryColor));
  doc.text("Net Balance", summaryBoxX + 6, 100);

  const netVal = `${account.currency} ${fmtInt(net)} ${balanceLabel(net)}`;
  const netColor = net >= 0 ? successColor : dangerColor;
  doc.setTextColor(...rgb(netColor));
  doc.text(netVal, W - 16, 100, { align: "right" });

  autoTable(doc, {
    startY: 118,
    head: [["DATE", "DETAILS", "DEBIT", "CREDIT", "BALANCE"]],
    body: rows.map((r) => [
      formatDate(r.txn_date),
      r.details,
      Number(r.debit) > 0 ? Math.round(Number(r.debit)).toLocaleString() : "-",
      Number(r.credit) > 0 ? Math.round(Number(r.credit)).toLocaleString() : "-",
      `${Math.round(Math.abs(r.balance)).toLocaleString()} ${balanceLabel(r.balance)}`,
    ]),
    styles: {
      fontSize: 10,
      cellPadding: { top: 4, right: 4, bottom: 4, left: 4 },
      font: "helvetica",
      textColor: inkColor,
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: primaryColor,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 10,
      halign: "left",
    },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 30, halign: "right" },
      3: { cellWidth: 30, halign: "right" },
      4: { cellWidth: 35, halign: "right" },
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 4) {
        const r = rows[data.row.index];
        data.cell.styles.textColor = r.balance >= 0 ? successColor : dangerColor;
        data.cell.styles.fontStyle = "bold";
      }
    },
    margin: { left: 10, right: 10 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.line(10, H - 24, W - 10, H - 24);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...rgb(mutedColor));
    doc.text("This is a computer generated statement and does not require a signature.", W / 2, H - 20, { align: "center" });
    doc.text(`Page ${page} of ${pageCount}`, W / 2, H - 15, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...rgb(primaryColor));
    doc.text(`${businessName} - Statement issued via AsaanKhata`, W / 2, H - 10, { align: "center" });
  }

  doc.save(`${account.account_no}-statement.pdf`);
}

export function exportLedgerPDF(rows: any[]) {
  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(26, 54, 93);
  doc.rect(0, 0, W, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("AsaanKhata", 14, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Ledger Report - All Accounts", 14, 21);
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, W - 14, 36, { align: "right" });

  autoTable(doc, {
    startY: 42,
    head: [["Account No", "Name", "Cur", "Debit", "Credit", "Net"]],
    body: rows.map((r) => [
      r.account_no,
      r.name,
      r.currency,
      formatMoney(r.debit),
      formatMoney(r.credit),
      `${formatMoney(r.net)} ${balanceLabel(r.net)}`,
    ]),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [15, 76, 78], textColor: 255 },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 5) {
        const r = rows[data.row.index];
        data.cell.styles.textColor = r.net >= 0 ? [20, 130, 80] : [180, 30, 30];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  doc.save("ledger-report.pdf");
}
