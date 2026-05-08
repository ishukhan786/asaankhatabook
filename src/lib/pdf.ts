import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatMoney, balanceLabel, formatDate } from "./format";

export function exportStatementPDF(account: any, rows: any[]) {
  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Branding Colors
  const primaryColor = [15, 76, 78]; // Dark Slate Teal
  const accentColor = [22, 101, 52]; // Dark Green
  const dangerColor = [153, 27, 27]; // Dark Red

  // Header / Top Bar
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, W, 40, "F");

  // Logo / Title
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("AsaanKhata", 15, 18);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Professional Digital Ledger Solution", 15, 25);

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("ACCOUNT STATEMENT", W - 15, 22, { align: "right" });
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, W - 15, 29, { align: "right" });

  // Account Information & Summary Cards
  // Left Column: Account Details
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("ACCOUNT HOLDER", 15, 52);
  
  doc.setDrawColor(200, 200, 200);
  doc.line(15, 54, 80, 54);

  doc.setFontSize(14);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(account.name.toUpperCase(), 15, 62);

  doc.setTextColor(80, 80, 80);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Account No: ${account.account_no}`, 15, 68);
  doc.text(`Currency: ${account.currency}`, 15, 73);
  if (account.mobile) doc.text(`Mobile: ${account.mobile}`, 15, 78);
  if (account.branches?.name) doc.text(`Branch: ${account.branches.name}`, 15, 83);

  // Right Column: Summary Box
  const totalDebit = rows.reduce((s, r) => s + Number(r.debit), 0);
  const totalCredit = rows.reduce((s, r) => s + Number(r.credit), 0);
  const net = totalCredit - totalDebit;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(W - 85, 48, 70, 40, 3, 3, "F");
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(W - 85, 48, 70, 40, 3, 3, "D");

  doc.setTextColor(71, 85, 105);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("STATEMENT SUMMARY", W - 78, 55);

  doc.setFont("helvetica", "normal");
  doc.text("Total Credit:", W - 78, 62);
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text(formatMoney(totalCredit, account.currency), W - 22, 62, { align: "right" });

  doc.setTextColor(71, 85, 105);
  doc.text("Total Debit:", W - 78, 68);
  doc.setTextColor(dangerColor[0], dangerColor[1], dangerColor[2]);
  doc.text(formatMoney(totalDebit, account.currency), W - 22, 68, { align: "right" });

  doc.setDrawColor(226, 232, 240);
  doc.line(W - 78, 72, W - 22, 72);

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont("helvetica", "bold");
  doc.text("NET BALANCE:", W - 78, 78);
  doc.setFontSize(10);
  const balanceStr = `${formatMoney(net, account.currency)} ${balanceLabel(net)}`;
  doc.text(balanceStr, W - 22, 78, { align: "right" });

  // Main Transaction Table
  autoTable(doc, {
    startY: 95,
    head: [["DATE", "DETAILS", "DEBIT", "CREDIT", "BALANCE"]],
    body: rows.map((r) => [
      formatDate(r.txn_date),
      r.details,
      Number(r.debit) > 0 ? formatMoney(Number(r.debit)) : "—",
      Number(r.credit) > 0 ? formatMoney(Number(r.credit)) : "—",
      `${formatMoney(r.balance)} ${balanceLabel(r.balance)}`,
    ]),
    styles: { 
      fontSize: 8.5, 
      cellPadding: { top: 4, right: 4, bottom: 4, left: 4 },
      font: "helvetica",
      textColor: [50, 50, 50],
      lineColor: [230, 230, 230],
      lineWidth: 0.1,
    },
    headStyles: { 
      fillColor: primaryColor, 
      textColor: 255, 
      fontStyle: "bold",
      fontSize: 9,
      halign: "left"
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 30, halign: "right" },
      3: { cellWidth: 30, halign: "right" },
      4: { cellWidth: 35, halign: "right" },
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250]
    },
    didParseCell: (data) => {
      if (data.section === "body") {
        if (data.column.index === 2 && data.cell.raw !== "—") data.cell.styles.textColor = dangerColor;
        if (data.column.index === 3 && data.cell.raw !== "—") data.cell.styles.textColor = accentColor;
        if (data.column.index === 4) {
          const r = rows[data.row.index];
          data.cell.styles.textColor = r.balance >= 0 ? accentColor : dangerColor;
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    margin: { left: 15, right: 15 },
  });

  // Footer
  const finalY = (doc as any).lastAutoTable.finalY || 100;
  if (finalY < H - 40) {
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("This is a computer generated statement and does not require a signature.", W / 2, H - 20, { align: "center" });
    doc.text("Page 1 of 1", W / 2, H - 15, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("AsaanKhata - Your Trusted Business Ledger", W / 2, H - 25, { align: "center" });
  }

  doc.save(`${account.account_no}-statement.pdf`);
}

export function exportLedgerPDF(rows: any[]) {
  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(15, 76, 78);
  doc.rect(0, 0, W, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("AsaanKhata", 14, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Ledger Report — All Accounts", 14, 21);
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, W - 14, 36, { align: "right" });

  autoTable(doc, {
    startY: 42,
    head: [["Account No", "Name", "Cur", "Debit", "Credit", "Net"]],
    body: rows.map((r) => [
      r.account_no, r.name, r.currency,
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

  doc.save(`ledger-report.pdf`);
}
