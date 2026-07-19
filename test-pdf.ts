import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { URDU_FONT_BASE64 } from "./src/lib/urdu-font-base64";

const URDU_FONT_NAME = "NotoNaskhArabic";

function run() {
  const doc = new jsPDF();
  
  console.log("Loading font...");
  doc.addFileToVFS(`${URDU_FONT_NAME}.ttf`, URDU_FONT_BASE64);
  doc.addFont(`${URDU_FONT_NAME}.ttf`, URDU_FONT_NAME, "normal");
  
  console.log("Font loaded. Drawing text...");
  doc.setFont(URDU_FONT_NAME, "normal");
  doc.setFontSize(16);
  
  const text = "100,000: جمع کیا";
  // Just like the code does
  const reverseUrduText = (str: string) => str.split("").reverse().join("");
  const printableText = reverseUrduText(text);
  
  doc.text(printableText, 10, 20);
  
  console.log("Drawing autotable...");
  autoTable(doc, {
    startY: 30,
    head: [["ID", "Description"]],
    body: [
      [1, printableText],
      [2, "English text"]
    ],
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 1) {
        data.cell.styles.font = URDU_FONT_NAME;
        data.cell.styles.fontStyle = "normal";
      }
    }
  });

  doc.save("test-output.pdf");
  console.log("PDF saved successfully to test-output.pdf");
}

try {
  run();
} catch (e) {
  console.error("Failed to generate PDF:", e);
}
