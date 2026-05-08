import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatMoney, balanceLabel, formatDate } from "./format";

export function exportStatementPDF(account: any, rows: any[]) {
  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Branding Colors (Navy Blue & Professional Yellow)
  const primaryColor = [26, 54, 93];   // Navy Blue
  const accentColor = [214, 158, 46];  // Golden Yellow
  const dangerColor = [180, 30, 30];   // Professional Red

  // Header / Top Bar
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, W, 40, "F");

  // Logo / Title
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("AsaanKhata", 10, 18);
  
  // Golden Accent Line
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(10, 21, 30, 1.5, "F");
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Professional Digital Ledger Solution", 10, 28);

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
  doc.text("ACCOUNT HOLDER", 10, 52);
  
  doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.line(10, 54, 55, 54);

  doc.setFontSize(14);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(account.name.toUpperCase(), 10, 62);

  doc.setTextColor(80, 80, 80);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Account No: ${account.account_no}`, 10, 68);
  doc.text(`Currency: ${account.currency}`, 10, 73);
  if (account.mobile) doc.text(`Mobile: ${account.mobile}`, 10, 78);
  if (account.branches?.name) doc.text(`Branch: ${account.branches.name}`, 10, 83);

  // Right Column: Summary Box
  const totalDebit = rows.reduce((s, r) => s + Number(r.debit), 0);
  const totalCredit = rows.reduce((s, r) => s + Number(r.credit), 0);
  const net = totalCredit - totalDebit;

  const summaryBoxWidth = 85;
  const summaryBoxX = W - summaryBoxWidth - 10;
  doc.setFillColor(245, 248, 255);
  doc.roundedRect(summaryBoxX, 48, summaryBoxWidth, 40, 3, 3, "F");
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.roundedRect(summaryBoxX, 48, summaryBoxWidth, 40, 3, 3, "D");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("STATEMENT SUMMARY", summaryBoxX + 5, 55);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const fmtInt = (n: number) => Math.round(Math.abs(n)).toLocaleString();
  
  doc.setTextColor(71, 85, 105);
  doc.text("Total Credit:", summaryBoxX + 5, 62);
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text(`${account.currency} ${fmtInt(totalCredit)}`, W - 15, 62, { align: "right" });

  doc.setTextColor(71, 85, 105);
  doc.text("Total Debit:", summaryBoxX + 5, 70);
  doc.setTextColor(dangerColor[0], dangerColor[1], dangerColor[2]);
  doc.text(`${account.currency} ${fmtInt(totalDebit)}`, W - 15, 70, { align: "right" });

  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.line(summaryBoxX + 5, 74, W - 15, 74);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("NET BALANCE:", summaryBoxX + 5, 82);
  
  const netVal = `${account.currency} ${fmtInt(net)} ${balanceLabel(net)}`;
  const netColor = net >= 0 ? accentColor : dangerColor;
  doc.setTextColor(netColor[0], netColor[1], netColor[2]);
  doc.text(netVal, W - 15, 82, { align: "right" });

  // Main Transaction Table
  autoTable(doc, {
    startY: 95,
    head: [["DATE", "DETAILS", "DEBIT", "CREDIT", "BALANCE"]],
    body: rows.map((r) => [
      formatDate(r.txn_date),
      r.details,
      Number(r.debit) > 0 ? Math.round(Number(r.debit)).toLocaleString() : "—",
      Number(r.credit) > 0 ? Math.round(Number(r.credit)).toLocaleString() : "—",
      `${Math.round(Math.abs(r.balance)).toLocaleString()} ${balanceLabel(r.balance)}`,
    ]),
    styles: { 
      fontSize: 10, 
      cellPadding: { top: 4, right: 4, bottom: 4, left: 4 },
      font: "helvetica",
      textColor: [0, 0, 0],
      lineColor: [230, 230, 230],
      lineWidth: 0.1,
    },
    headStyles: { 
      fillColor: primaryColor, 
      textColor: 255, 
      fontStyle: "bold",
      fontSize: 10,
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
        if (data.column.index === 4) {
          const r = rows[data.row.index];
          data.cell.styles.textColor = r.balance >= 0 ? accentColor : dangerColor;
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    margin: { left: 10, right: 10 },
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
  doc.setFillColor(26, 54, 93);
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
