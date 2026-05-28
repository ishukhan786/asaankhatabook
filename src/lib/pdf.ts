import { formatMoney, balanceLabel, formatDate } from "./format";

export type BusinessInfo = {
  business_name?: string | null;
  business_phone?: string | null;
  business_address?: string | null;
};

const rgb = (color: [number, number, number]) => color;

async function loadPdfLibs() {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  return { jsPDF, autoTable };
}

export type AccountForPDF = {
  account_no?: string | null;
  currency?: string | null;
  name?: string | null;
  mobile?: string | null;
  branches?: { name?: string | null } | null;
  address?: string | null;
};

export type TxnRow = {
  id?: string;
  txn_date?: string | null;
  details?: string | null;
  debit?: number | string | null;
  credit?: number | string | null;
  balance?: number | null;
};

export async function exportStatementPDF(account: AccountForPDF, rows: TxnRow[], businessInfo?: BusinessInfo | null) {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  const navy: [number, number, number] = [15, 23, 42];
  const ink: [number, number, number] = [30, 41, 59];
  const muted: [number, number, number] = [100, 116, 139];
  const line: [number, number, number] = [226, 232, 240];
  const soft: [number, number, number] = [248, 250, 252];
  const card: [number, number, number] = [255, 255, 255];
  const accent: [number, number, number] = [245, 158, 11];
  const debitColor: [number, number, number] = [185, 28, 28];
  const creditColor: [number, number, number] = [22, 101, 52];

  const businessName = businessInfo?.business_name?.trim() || "AsaanKhata";
  const businessLines = [
    businessInfo?.business_address,
    businessInfo?.business_phone ? `Contact: ${businessInfo.business_phone}` : "",
  ].filter((line): line is string => Boolean(line?.trim()));

  const totalDebit = rows.reduce((s, r) => s + Number(r.debit), 0);
  const totalCredit = rows.reduce((s, r) => s + Number(r.credit), 0);
  const net = totalCredit - totalDebit;
  const currency = account.currency || "";
  const generatedAt = new Date().toLocaleString();
  const money = (n: number | string | null | undefined) => formatMoney(n, currency);
  const plainAmount = (n: number | string | null | undefined) => formatMoney(n);
  const signedBalance = (n: number) => `${money(n)} ${balanceLabel(n)}`;
  const plainSignedBalance = (n: number) => `${plainAmount(n)} ${balanceLabel(n)}`;

  doc.setFillColor(...rgb(soft));
  doc.rect(0, 0, W, H, "F");

  doc.setFillColor(...rgb(card));
  doc.roundedRect(10, 10, W - 20, 35, 2.5, 2.5, "F");
  doc.setDrawColor(...rgb(line));
  doc.setLineWidth(0.2);
  doc.roundedRect(10, 10, W - 20, 35, 2.5, 2.5, "D");
  doc.setDrawColor(...rgb(accent));
  doc.setLineWidth(0.8);
  doc.line(10, 10, 10, 45);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...rgb(navy));
  doc.text(businessName, 16, 21, { maxWidth: 92 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...rgb(muted));
  const headerBusinessLines = businessLines.length ? businessLines : ["Professional cloud accounting ledger"];
  doc.text(headerBusinessLines.join("  |  "), 16, 28, { maxWidth: 104 });
  doc.text("AsaanKhata Ledger Suite", 16, 35);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...rgb(navy));
  doc.text("Account Statement", W - 16, 21, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...rgb(muted));
  doc.text(`Generated ${generatedAt}`, W - 16, 29, { align: "right" });
  doc.text(`Statement Ref: ${account.account_no || "ACCOUNT"}`, W - 16, 35, { align: "right" });

  const sectionY = 51;
  const sectionH = 42;
  const sectionGap = 5;
  const infoW = 116;
  const summaryX = 10 + infoW + sectionGap;
  const summaryW = W - 20 - infoW - sectionGap;

  doc.setFillColor(...rgb(card));
  doc.roundedRect(10, sectionY, infoW, sectionH, 2.5, 2.5, "F");
  doc.setDrawColor(...rgb(line));
  doc.roundedRect(10, sectionY, infoW, sectionH, 2.5, 2.5, "D");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...rgb(navy));
  doc.text(String(account.name || "-"), 16, sectionY + 10, { maxWidth: infoW - 12 });

  const drawMetaLine = (label: string, value: string, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...rgb(muted));
    doc.text(`${label}:`, 16, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...rgb(ink));
    doc.text(String(value || "-"), 38, y, { maxWidth: infoW - 30 });
  };

  let currentY = sectionY + 18;
  const step = 4.5;
  drawMetaLine("Account No", account.account_no || "-", currentY); currentY += step;
  drawMetaLine("Currency", currency || "-", currentY); currentY += step;
  drawMetaLine("Mobile", account.mobile || "-", currentY); currentY += step;
  drawMetaLine("Address", account.address || "-", currentY);

  doc.setFillColor(...rgb(card));
  doc.roundedRect(summaryX, sectionY, summaryW, sectionH, 2.5, 2.5, "F");
  doc.setDrawColor(...rgb(line));
  doc.roundedRect(summaryX, sectionY, summaryW, sectionH, 2.5, 2.5, "D");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...rgb(navy));
  doc.text("Amount Summary", summaryX + 6, sectionY + 8);
  doc.setDrawColor(...rgb(line));
  doc.setLineWidth(0.1);
  doc.line(summaryX + 6, sectionY + 12, summaryX + summaryW - 6, sectionY + 12);

  const drawSummaryRow = (label: string, value: string, y: number, color: [number, number, number]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...rgb(muted));
    doc.text(label.toUpperCase(), summaryX + 6, y);
    doc.setFontSize(8.7);
    doc.setTextColor(...rgb(color));
    doc.text(value, summaryX + summaryW - 6, y, { align: "right", maxWidth: 38 });
  };

  drawSummaryRow("Transactions", String(rows.length), sectionY + 19, navy);
  drawSummaryRow("Total Debit", money(totalDebit), sectionY + 26, debitColor);
  drawSummaryRow("Total Credit", money(totalCredit), sectionY + 33, creditColor);
  drawSummaryRow("Closing Balance", signedBalance(net), sectionY + 40, net >= 0 ? creditColor : debitColor);

  let runningBalance = 0;
  const tableBody = rows.map((r) => {
    const currentBalance = r.balance !== undefined && r.balance !== null
      ? r.balance
      : (runningBalance += (Number(r.credit ?? 0) - Number(r.debit ?? 0)));
    return [
      formatDate(String(r.txn_date ?? "")),
      r.details ?? "",
      Number(r.debit ?? 0) > 0 ? plainAmount(Number(r.debit)) : "-",
      Number(r.credit ?? 0) > 0 ? plainAmount(Number(r.credit)) : "-",
      plainSignedBalance(currentBalance ?? 0),
    ];
  });

  autoTable(doc, {
    startY: 101,
    head: [["Date", "Description", "Debit", "Credit", "Balance"]],
    body: tableBody,
    styles: {
      fontSize: 8.2,
      cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
      font: "helvetica",
      textColor: ink,
      lineColor: line,
      lineWidth: 0.1,
      valign: "middle",
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: navy,
      fontStyle: "bold",
      fontSize: 7.8,
      halign: "left",
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 28, halign: "right", textColor: ink },
      3: { cellWidth: 28, halign: "right", textColor: ink },
      4: { cellWidth: 32, halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: {
      fillColor: [252, 253, 255],
    },
    didParseCell: (data) => {
      if (data.section === "body" && (data.column.index === 2 || data.column.index === 3)) {
        data.cell.styles.textColor = ink;
      }
      if (data.section === "body" && data.column.index === 4) {
        const r = rows[data.row.index];
        let currentBalance = r.balance;
        if (currentBalance === undefined) {
          let rb = 0;
          for (let i = 0; i <= data.row.index; i++) {
            rb += (Number(rows[i].credit) - Number(rows[i].debit));
          }
          currentBalance = rb;
        }
        data.cell.styles.textColor = currentBalance >= 0 ? creditColor : debitColor;
        data.cell.styles.fontStyle = "bold";
      }
    },
    margin: { left: 10, right: 10 },
    tableLineColor: line,
    tableLineWidth: 0.1,
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setDrawColor(...rgb(line));
    doc.line(10, H - 18, W - 10, H - 18);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...rgb(muted));
    doc.text("This computer-generated statement is for business record purposes and does not require a signature.", 10, H - 12);
    doc.text(`Page ${page} of ${pageCount}`, W - 10, H - 12, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...rgb(navy));
    doc.text(`${businessName} | Powered by AsaanKhata Ledger Suite`, 10, H - 7);
  }

  doc.save(`${account.account_no}-statement.pdf`);
}

export type LedgerRow = {
  account_no?: string | null;
  name?: string | null;
  currency?: string | null;
  debit?: number | string | null;
  credit?: number | string | null;
  net?: number | null;
};

export async function exportLedgerPDF(rows: LedgerRow[]) {
  const { jsPDF, autoTable } = await loadPdfLibs();
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
      `${formatMoney(r.net ?? 0)} ${balanceLabel(r.net ?? 0)}`,
    ]),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [15, 76, 78], textColor: 255 },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 5) {
        const r = rows[data.row.index];
        const net = r.net ?? 0;
        data.cell.styles.textColor = net >= 0 ? [20, 130, 80] : [180, 30, 30];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  doc.save("ledger-report.pdf");
}
