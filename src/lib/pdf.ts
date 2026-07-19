import { formatMoney, balanceLabel, formatDate } from "./format";
import type { jsPDF } from "jspdf";

// ─── Urdu Font Support ────────────────────────────────────────────────────────
// Detect Urdu/Arabic characters in text
function containsUrdu(text: string): boolean {
  // Arabic Unicode range: \u0600-\u06FF (includes Urdu)
  // Arabic Presentation Forms: \uFB50-\uFDFF, \uFE70-\uFEFF
  return /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

// Use jsPDF's built-in processArabic for proper Urdu/Arabic shaping + RTL
// Falls back to plain text for non-Urdu strings
function pdfText(doc: jsPDF, text: string): string {
  if (!text) return text;
  if (!containsUrdu(text)) return text;
  // processArabic handles character joining, ligatures, and RTL ordering
  return (doc as jsPDF & { processArabic: (t: string) => string }).processArabic(text);
}

// Font name constant
const URDU_FONT_NAME = "NotoNaskhArabic";

// Load and embed Urdu font into jsPDF document
import { URDU_FONT_BASE64, FONT_AVAILABLE } from "./urdu-font-base64";

let urduFontBase64: string | null = null;
let fontLoaded = false;

async function getUrduFontBase64(): Promise<string | null> {
  if (fontLoaded) return urduFontBase64;
  if (FONT_AVAILABLE && URDU_FONT_BASE64) {
    urduFontBase64 = URDU_FONT_BASE64;
  } else {
    urduFontBase64 = null;
  }
  fontLoaded = true;
  return urduFontBase64;
}

function embedUrduFont(doc: jsPDF, fontBase64: string) {
  try {
    doc.addFileToVFS(`${URDU_FONT_NAME}.ttf`, fontBase64);
    doc.addFont(`${URDU_FONT_NAME}.ttf`, URDU_FONT_NAME, "normal");
    return true;
  } catch {
    return false;
  }
}

// Set font based on whether text contains Urdu
function setFont(
  doc: jsPDF,
  hasUrduFont: boolean,
  style: "normal" | "bold" = "normal"
) {
  if (hasUrduFont) {
    doc.setFont(URDU_FONT_NAME, "normal"); // Urdu font only has normal style
  } else {
    doc.setFont("helvetica", style);
  }
}

export type BusinessInfo = {
  business_name?: string | null;
  business_phone?: string | null;
  business_address?: string | null;
};

const rgb = (color: [number, number, number]) => color;

async function loadPdfLibs() {
  const [{ default: jsPDF }, { default: autoTable }, fontBase64] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    getUrduFontBase64(),
  ]);
  return { jsPDF, autoTable, fontBase64 };
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

// ─── Color Palette ───────────────────────────────────────────────────────────
const C = {
  navy:       [10,  18,  40]  as [number,number,number],
  navyMid:    [20,  34,  72]  as [number,number,number],
  ink:        [30,  41,  59]  as [number,number,number],
  muted:      [100, 116, 139] as [number,number,number],
  line:       [220, 228, 240] as [number,number,number],
  soft:       [245, 248, 252] as [number,number,number],
  white:      [255, 255, 255] as [number,number,number],
  accent:     [245, 158, 11]  as [number,number,number],   // amber
  accentSoft: [254, 243, 199] as [number,number,number],   // amber tint
  teal:       [13,  148, 136] as [number,number,number],   // teal
  tealSoft:   [204, 240, 237] as [number,number,number],
  debit:      [185, 28,  28]  as [number,number,number],
  debitSoft:  [254, 226, 226] as [number,number,number],
  credit:     [21,  128, 61]  as [number,number,number],
  creditSoft: [220, 252, 231] as [number,number,number],
  neutral:    [241, 245, 249] as [number,number,number],
};

export async function exportStatementPDF(
  account: AccountForPDF,
  rows: TxnRow[],
  businessInfo?: BusinessInfo | null
) {
  const { jsPDF, autoTable, fontBase64 } = await loadPdfLibs();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Embed Urdu font if available
  const hasUrduFont = fontBase64 ? embedUrduFont(doc, fontBase64) : false;

  const businessName  = businessInfo?.business_name?.trim() || "AsaanKhata";
  const bizAddress    = businessInfo?.business_address?.trim() || "";
  const bizPhone      = businessInfo?.business_phone?.trim()   || "";

  const totalDebit  = rows.reduce((s, r) => s + Number(r.debit  ?? 0), 0);
  const totalCredit = rows.reduce((s, r) => s + Number(r.credit ?? 0), 0);
  const net         = totalCredit - totalDebit;
  const currency    = account.currency || "";
  const generatedAt = new Date().toLocaleString("en-PK", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const money            = (n: number | string | null | undefined) => formatMoney(n, currency);
  const plainAmount      = (n: number | string | null | undefined) => formatMoney(n);
  const signedBalance    = (n: number) => `${money(n)} ${balanceLabel(n)}`;
  const plainSignedBal   = (n: number) => `${plainAmount(n)} ${balanceLabel(n)}`;

  // ─── Helper: draw rounded rect with optional fill + stroke ────────────────
  const roundRect = (
    x: number, y: number, w: number, h: number,
    r = 2.5,
    fill?: [number,number,number],
    stroke?: [number,number,number],
    strokeW = 0.2
  ) => {
    if (fill)   { doc.setFillColor(...rgb(fill));   }
    if (stroke) { doc.setDrawColor(...rgb(stroke)); doc.setLineWidth(strokeW); }
    doc.roundedRect(x, y, w, h, r, r, fill && stroke ? "FD" : fill ? "F" : "D");
  };

  // ══════════════════════════════════════════════════════════════════════════
  // WATERMARK — subtle "STATEMENT" behind content on every page
  // ══════════════════════════════════════════════════════════════════════════
  const drawWatermark = () => {
    doc.saveGraphicsState?.();
    doc.setTextColor(242, 245, 249);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(52);
    // jsPDF text rotation via transform
    doc.text("STATEMENT", W / 2, H / 2 + 10, {
      align: "center",
      angle: 45,
    });
    doc.setFont("helvetica", "normal");
  };

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE BORDER
  // ══════════════════════════════════════════════════════════════════════════
  const drawPageBorder = () => {
    doc.setDrawColor(...rgb(C.line));
    doc.setLineWidth(0.4);
    doc.rect(6, 6, W - 12, H - 12);
    // inner thin border
    doc.setDrawColor(210, 220, 235);
    doc.setLineWidth(0.15);
    doc.rect(7.5, 7.5, W - 15, H - 15);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // HEADER — dark navy with decorative circles + amber accent bar
  // ══════════════════════════════════════════════════════════════════════════
  const HEADER_H = 40;

  const drawHeader = () => {
    // Background fill
    doc.setFillColor(...rgb(C.navy));
    doc.rect(0, 0, W, HEADER_H, "F");

    // Decorative circle — top-right glow
    doc.setFillColor(30, 50, 100);
    doc.circle(W - 10, 0, 34, "F");
    doc.setFillColor(20, 35, 75);
    doc.circle(W - 28, 5, 20, "F");

    // Amber accent left bar
    doc.setFillColor(...rgb(C.accent));
    doc.rect(0, 0, 4, HEADER_H, "F");

    // Teal bottom strip
    doc.setFillColor(...rgb(C.teal));
    doc.rect(0, HEADER_H - 2.5, W, 2.5, "F");

    // Business name - detect Urdu
    const bizNameIsUrdu = containsUrdu(businessName);
    if (bizNameIsUrdu && hasUrduFont) {
      doc.setFont(URDU_FONT_NAME, "normal");
      doc.setFontSize(15);
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(17);
    }
    doc.setTextColor(...rgb(C.white));
    if (bizNameIsUrdu && hasUrduFont) {
      // RTL: align right for Urdu text
      doc.text(pdfText(doc, businessName), W - 12, 18, { align: "right", maxWidth: 100 });
    } else {
      doc.text(businessName.toUpperCase(), 12, 18, { maxWidth: 100 });
    }

    // Tagline / address - detect Urdu
    doc.setFontSize(7.5);
    doc.setTextColor(180, 198, 230);
    const tagParts = [bizAddress, bizPhone ? `Tel: ${bizPhone}` : ""].filter(Boolean);
    const tagText = tagParts.length ? tagParts.join("   ·   ") : "Professional Ledger & Accounting";
    const tagIsUrdu = containsUrdu(tagText);
    if (tagIsUrdu && hasUrduFont) {
      doc.setFont(URDU_FONT_NAME, "normal");
      doc.text(pdfText(doc, tagText), W - 12, 25, { align: "right", maxWidth: 110 });
    } else {
      doc.setFont("helvetica", "normal");
      doc.text(tagText, 12, 25, { maxWidth: 110 });
    }

    // "Powered by" badge
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...rgb(C.accent));
    doc.text("AsaanKhata Ledger Suite", 12, 33);

    // Right side — document title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(19);
    doc.setTextColor(...rgb(C.white));
    doc.text("Account Statement", W - 12, 16, { align: "right" });

    // Sub-labels right
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(180, 198, 230);
    doc.text(`Generated: ${generatedAt}`, W - 12, 24, { align: "right" });

    // Ref badge
    doc.setFillColor(...rgb(C.navyMid));
    roundRect(W - 62, 28, 50, 7, 1.5, C.navyMid, C.teal, 0.4);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(...rgb(C.teal));
    doc.text("REF:", W - 59, 33);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(200, 215, 240);
    doc.text(account.account_no || "ACCOUNT", W - 53, 33);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ACCOUNT INFO CARD
  // ══════════════════════════════════════════════════════════════════════════
  const INFO_Y  = HEADER_H + 8;
  const INFO_H  = 50;
  const INFO_W  = 106;
  const SUM_X   = 10 + INFO_W + 5;
  const SUM_W   = W - 20 - INFO_W - 5;

  const drawInfoCard = () => {
    roundRect(10, INFO_Y, INFO_W, INFO_H, 3, C.white, C.line, 0.2);

    // Left accent strip
    doc.setFillColor(...rgb(C.teal));
    doc.roundedRect(10, INFO_Y, 3.5, INFO_H, 1.5, 1.5, "F");

    // Section label
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...rgb(C.teal));
    doc.text("ACCOUNT HOLDER", 17, INFO_Y + 8);

    // Name - detect Urdu and use appropriate font
    const nameIsUrdu = containsUrdu(String(account.name || ""));
    if (nameIsUrdu && hasUrduFont) {
      doc.setFont(URDU_FONT_NAME, "normal");
      doc.setFontSize(12.5);
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12.5);
    }
    doc.setTextColor(...rgb(C.navy));
    if (nameIsUrdu && hasUrduFont) {
      doc.text(pdfText(doc, String(account.name || "—")), 10 + INFO_W - 6, INFO_Y + 16, { align: "right", maxWidth: INFO_W - 14 });
    } else {
      doc.text(String(account.name || "—"), 17, INFO_Y + 16, { maxWidth: INFO_W - 14 });
    }

    // Divider
    doc.setDrawColor(...rgb(C.line));
    doc.setLineWidth(0.2);
    doc.line(17, INFO_Y + 20, 10 + INFO_W - 6, INFO_Y + 20);

    // Meta rows
    const meta = [
      ["Account No",  account.account_no  || "—"],
      ["Currency",    currency             || "—"],
      ["Mobile",      account.mobile       || "—"],
      ["Branch",      account.branches?.name || "—"],
      ["Address",     account.address      || "—"],
    ];
    meta.forEach(([label, value], i) => {
      const y = INFO_Y + 26 + i * 5;
      
      // Label text (always English)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...rgb(C.muted));
      doc.text(String(label), 17, y);

      // Teal colon
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(13, 148, 136);
      doc.text(":", 36, y);

      // Value text - detect Urdu
      const valStr = String(value);
      const valIsUrdu = containsUrdu(valStr);
      if (valIsUrdu && hasUrduFont) {
        doc.setFont(URDU_FONT_NAME, "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...rgb(C.ink));
        // Right-align Urdu text within the available width
        doc.text(pdfText(doc, valStr), 10 + INFO_W - 6, y, { align: "right", maxWidth: INFO_W - 36 });
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...rgb(C.ink));
        doc.text(valStr, 42, y, { maxWidth: INFO_W - 36 });
      }
    });
  };

  // ══════════════════════════════════════════════════════════════════════════
  // SUMMARY CARD — 4 KPI tiles stacked
  // ══════════════════════════════════════════════════════════════════════════
  const drawSummaryCard = () => {
    roundRect(SUM_X, INFO_Y, SUM_W, INFO_H, 3, C.white, C.line, 0.2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...rgb(C.teal));
    doc.text("AMOUNT SUMMARY", SUM_X + 6, INFO_Y + 8);

    const tiles: [string, string, [number,number,number], [number,number,number]][] = [
      ["TOTAL DEBIT",     money(totalDebit),       C.debit, C.debitSoft],
      ["TOTAL CREDIT",    money(totalCredit),      C.credit,C.creditSoft],
      ["CLOSING BALANCE", signedBalance(net),      net >= 0 ? C.credit : C.debit, net >= 0 ? C.creditSoft : C.debitSoft],
    ];

    const tileH = 9;
    const tileY0 = INFO_Y + 13;
    tiles.forEach(([label, value, textCol, bgCol], i) => {
      const ty = tileY0 + i * (tileH + 1.5);
      roundRect(SUM_X + 4, ty, SUM_W - 8, tileH, 1.5, bgCol);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(...rgb(C.muted));
      doc.text(label, SUM_X + 8, ty + 4);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...rgb(textCol));
      doc.text(value, SUM_X + SUM_W - 8, ty + 6.5, { align: "right", maxWidth: SUM_W - 16 });
    });
  };

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION LABEL before table
  // ══════════════════════════════════════════════════════════════════════════
  const TABLE_LABEL_Y = INFO_Y + INFO_H + 6;

  const drawTableLabel = () => {
    doc.setFillColor(...rgb(C.navy));
    roundRect(10, TABLE_LABEL_Y, W - 20, 8, 1.5, C.navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...rgb(C.accent));
    doc.text("TRANSACTION HISTORY", 16, TABLE_LABEL_Y + 5.2);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(160, 180, 210);
    doc.text(`${rows.length} records`, W - 14, TABLE_LABEL_Y + 5.2, { align: "right" });
  };

  // ══════════════════════════════════════════════════════════════════════════
  // BUILD TABLE BODY
  // ══════════════════════════════════════════════════════════════════════════
  let runningBalance = 0;
  const tableBody = rows.map((r) => {
    const bal =
      r.balance !== undefined && r.balance !== null
        ? r.balance
        : (runningBalance += Number(r.credit ?? 0) - Number(r.debit ?? 0));
    // Apply pdfText for Urdu/Arabic details so they render correctly
    const details = r.details ?? "";
    return [
      formatDate(String(r.txn_date ?? "")),
      pdfText(doc, details),  // processArabic for proper Urdu RTL
      Number(r.debit  ?? 0) > 0 ? plainAmount(Number(r.debit))  : "—",
      Number(r.credit ?? 0) > 0 ? plainAmount(Number(r.credit)) : "—",
      signedBalance(bal),
    ];
  });

  // ══════════════════════════════════════════════════════════════════════════
  // FOOTER
  // ══════════════════════════════════════════════════════════════════════════
  const drawFooter = (page: number, total: number) => {
    // Teal footer bar
    doc.setFillColor(...rgb(C.teal));
    doc.rect(0, H - 14, W, 14, "F");

    // Amber left strip
    doc.setFillColor(...rgb(C.accent));
    doc.rect(0, H - 14, 4, 14, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...rgb(C.white));
    doc.text(`${businessName}  ·  Powered by AsaanKhata Ledger Suite`, 10, H - 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(200, 240, 235);
    doc.text(
      "This computer-generated statement is for business record purposes only.",
      10, H - 3
    );

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...rgb(C.white));
    doc.text(`Page ${page} / ${total}`, W - 10, H - 7, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(200, 240, 235);
    doc.text(`Ref: ${account.account_no || "ACCOUNT"}`, W - 10, H - 3, { align: "right" });
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER PAGE 1 HEADER SECTIONS
  // ══════════════════════════════════════════════════════════════════════════
  drawWatermark();
  drawPageBorder();
  drawHeader();
  drawInfoCard();
  drawSummaryCard();
  drawTableLabel();

  // ══════════════════════════════════════════════════════════════════════════
  // AUTOTABLE
  // ══════════════════════════════════════════════════════════════════════════
  autoTable(doc, {
    startY: TABLE_LABEL_Y + 10,
    head: [["Date", "Description", "Debit", "Credit", "Balance"]],
    body: tableBody,
    styles: {
      fontSize: 8,
      cellPadding: { top: 3.2, right: 4, bottom: 3.2, left: 4 },
      font: "helvetica",
      textColor: C.ink,
      lineColor: C.line,
      lineWidth: 0.12,
      valign: "middle",
    },
    headStyles: {
      fillColor: C.navy,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "left",
      cellPadding: { top: 3.5, right: 4, bottom: 3.5, left: 4 },
    },
    columnStyles: {
      0: { cellWidth: 23, textColor: C.muted },
      1: { cellWidth: "auto" },
      2: { cellWidth: 26, halign: "right" },
      3: { cellWidth: 26, halign: "right" },
      4: { cellWidth: 30, halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 253],
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;

      // Description column — detect Urdu and set font + alignment
      if (data.column.index === 1) {
        const cellText = String(data.cell.raw ?? "");
        if (containsUrdu(cellText) && hasUrduFont) {
          data.cell.styles.font = URDU_FONT_NAME;
          data.cell.styles.fontStyle = "normal";
          data.cell.styles.halign = "right";
        }
      }

      // Debit column — red tint bg, text black
      if (data.column.index === 2 && data.cell.raw !== "—") {
        data.cell.styles.textColor = C.ink;
        data.cell.styles.fillColor = [255, 245, 245];
      }
      // Credit column — green tint bg, text black
      if (data.column.index === 3 && data.cell.raw !== "—") {
        data.cell.styles.textColor = C.ink;
        data.cell.styles.fillColor = [245, 255, 248];
      }
      // Balance column — colour by sign
      if (data.column.index === 4) {
        const r = rows[data.row.index];
        let bal = r.balance;
        if (bal === undefined || bal === null) {
          let rb = 0;
          for (let i = 0; i <= data.row.index; i++) {
            rb += Number(rows[i].credit ?? 0) - Number(rows[i].debit ?? 0);
          }
          bal = rb;
        }
        data.cell.styles.textColor = bal >= 0 ? C.credit : C.debit;
        data.cell.styles.fontStyle = "bold";
      }
    },
    margin: { left: 10, right: 10, bottom: 20 },
    tableLineColor: C.line,
    tableLineWidth: 0.12,
    // New page — redraw watermark + border + footer
    didDrawPage: (hookData) => {
      const pageNum = doc.getNumberOfPages();
      // On pages > 1, redraw watermark + border
      if (hookData.pageNumber > 1) {
        drawWatermark();
        drawPageBorder();
      }
    },
  });

  // ══════════════════════════════════════════════════════════════════════════
  // FOOTER ON ALL PAGES
  // ══════════════════════════════════════════════════════════════════════════
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    drawFooter(p, pageCount);
  }

  doc.save(`${account.account_no || "statement"}-statement.pdf`);
}

// ─── Ledger Report PDF (All Accounts) ───────────────────────────────────────

export type LedgerRow = {
  account_no?: string | null;
  name?: string | null;
  currency?: string | null;
  debit?: number | string | null;
  credit?: number | string | null;
  net?: number | null;
};

export async function exportLedgerPDF(rows: LedgerRow[], businessInfo?: BusinessInfo | null) {
  const { jsPDF, autoTable, fontBase64 } = await loadPdfLibs();
  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const businessName = businessInfo?.business_name?.trim() || "AsaanKhata";

  // Embed Urdu font if available
  const hasUrduFont = fontBase64 ? embedUrduFont(doc, fontBase64) : false;

  const pkrRows = rows.filter(r => r.currency === "PKR");
  const aedRows = rows.filter(r => r.currency === "AED");

  const pkrDebit = pkrRows.reduce((s, r) => s + Number(r.debit ?? 0), 0);
  const pkrCredit = pkrRows.reduce((s, r) => s + Number(r.credit ?? 0), 0);
  const pkrNet = pkrCredit - pkrDebit;

  const aedDebit = aedRows.reduce((s, r) => s + Number(r.debit ?? 0), 0);
  const aedCredit = aedRows.reduce((s, r) => s + Number(r.credit ?? 0), 0);
  const aedNet = aedCredit - aedDebit;

  // Header
  doc.setFillColor(...rgb(C.navy));
  doc.rect(0, 0, W, 30, "F");
  doc.setFillColor(...rgb(C.accent));
  doc.rect(0, 0, 4, 30, "F");
  doc.setFillColor(...rgb(C.teal));
  doc.rect(0, 28, W, 2, "F");

  // Decorative circle
  doc.setFillColor(20, 35, 70);
  doc.circle(W, 0, 28, "F");

  // Business name in header - detect Urdu
  const bizIsUrdu = containsUrdu(businessName);
  if (bizIsUrdu && hasUrduFont) {
    doc.setFont(URDU_FONT_NAME, "normal");
    doc.setFontSize(14);
    doc.setTextColor(...rgb(C.white));
    doc.text(pdfText(doc, businessName), W - 10, 13, { align: "right" });
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...rgb(C.white));
    doc.text(businessName.toUpperCase(), 10, 13);
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 198, 230);
  doc.text("Ledger Report — All Accounts", 10, 21);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...rgb(C.accent));
  doc.text("AsaanKhata Ledger Suite", 10, 27);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(180, 198, 230);
  doc.text(`Generated: ${new Date().toLocaleString()}`, W - 10, 21, { align: "right" });
  doc.text(`${rows.length} Accounts`, W - 10, 27, { align: "right" });

  // Summary strip
  const SY = 36;
  roundRectHelper(doc, 10, SY, W - 20, 14, 2, C.neutral, C.line, 0.2);

  let sumItems: [string, string, [number,number,number]][] = [];
  if (aedRows.length > 0 && pkrRows.length > 0) {
    sumItems = [
      ["ACCOUNTS", String(rows.length), C.ink],
      ["PKR NET BAL", `${formatMoney(pkrNet, "PKR")} ${balanceLabel(pkrNet)}`, pkrNet >= 0 ? C.credit : C.debit],
      ["AED NET BAL", `${formatMoney(aedNet, "AED")} ${balanceLabel(aedNet)}`, aedNet >= 0 ? C.credit : C.debit],
    ];
  } else {
    const activeCurrency = rows[0]?.currency || "PKR";
    const debit = activeCurrency === "AED" ? aedDebit : pkrDebit;
    const credit = activeCurrency === "AED" ? aedCredit : pkrCredit;
    const net = credit - debit;
    sumItems = [
      ["ACCOUNTS", String(rows.length), C.ink],
      ["TOTAL DEBIT", formatMoney(debit, activeCurrency), C.debit],
      ["TOTAL CREDIT", formatMoney(credit, activeCurrency), C.credit],
      ["NET BALANCE", `${formatMoney(net, activeCurrency)} ${balanceLabel(net)}`, net >= 0 ? C.credit : C.debit],
    ];
  }

  const itemCount = sumItems.length;
  sumItems.forEach(([label, val, col], i) => {
    const x = 16 + i * ((W - 32) / itemCount);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(...rgb(C.muted));
    doc.text(label, x, SY + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...rgb(col));
    doc.text(val, x, SY + 13);
  });

  autoTable(doc, {
    startY: SY + 20,
    head: [["Account No", "Name", "Cur", "Debit", "Credit", "Net Balance"]],
    body: rows.map((r) => [
      r.account_no ?? "—",
      pdfText(doc, r.name ?? "—"),  // processArabic for proper Urdu RTL
      r.currency   ?? "—",
      formatMoney(r.debit, r.currency),
      formatMoney(r.credit, r.currency),
      `${formatMoney(r.net ?? 0, r.currency)} ${balanceLabel(r.net ?? 0)}`,
    ]),
    styles: {
      fontSize: 8,
      cellPadding: { top: 3, right: 3.5, bottom: 3, left: 3.5 },
      font: "helvetica",
      textColor: C.ink,
      lineColor: C.line,
      lineWidth: 0.12,
    },
    headStyles: {
      fillColor: C.navy,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.5,
    },
    columnStyles: {
      0: { cellWidth: 28, textColor: C.muted, fontStyle: "bold" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 14, halign: "center" },
      3: { cellWidth: 26, halign: "right" },
      4: { cellWidth: 26, halign: "right" },
      5: { cellWidth: 32, halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: [248, 250, 253] },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      // Name column (index 1) - detect Urdu
      if (data.column.index === 1) {
        const nameText = String(data.cell.raw ?? "");
        if (containsUrdu(nameText) && hasUrduFont) {
          data.cell.styles.font = URDU_FONT_NAME;
          data.cell.styles.fontStyle = "normal";
          data.cell.styles.halign = "right";
        }
      }
      if (data.column.index === 5) {
        const net = rows[data.row.index]?.net ?? 0;
        data.cell.styles.textColor = net >= 0 ? C.credit : C.debit;
      }
    },
    margin: { left: 10, right: 10, bottom: 18 },
  });

  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFillColor(...rgb(C.teal));
    doc.rect(0, H - 12, W, 12, "F");
    doc.setFillColor(...rgb(C.accent));
    doc.rect(0, H - 12, 4, 12, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...rgb(C.white));
    doc.text(`${businessName}  ·  Powered by AsaanKhata Ledger Suite`, 10, H - 5);
    doc.text(`Page ${p} / ${pageCount}`, W - 10, H - 5, { align: "right" });
  }

  doc.save("ledger-report.pdf");
}

// helper used in ledger export (outside class scope)
function roundRectHelper(
  doc: jsPDF,
  x: number, y: number, w: number, h: number, r: number,
  fill?: [number,number,number],
  stroke?: [number,number,number],
  strokeW = 0.2
) {
  if (fill)   doc.setFillColor(...fill);
  if (stroke) { doc.setDrawColor(...stroke); doc.setLineWidth(strokeW); }
  doc.roundedRect(x, y, w, h, r, r, fill && stroke ? "FD" : fill ? "F" : "D");
}
