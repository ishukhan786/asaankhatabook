import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const savedLang = typeof window !== "undefined" ? localStorage.getItem("app_lang") || "en" : "en";

export const resources = {
  en: {
    translation: {
      // Navigation
      "Dashboard": "Dashboard",
      "Accounts": "Customers",
      "Transactions": "Transactions",
      "Expenses": "Expenses",
      "Reports": "Reports",
      "Settings": "Settings",
      "PayablesReceivables": "Payables & Receivables",
      "Payables": "Payables",
      "Receivables": "Receivables",
      "TotalPayable": "Total Payable",
      "TotalReceivable": "Total Receivable",
      "NewAccount": "Add New Customer",
      "NewTransaction": "Add New Entry",
      "Branches": "Branches",
      "AdminPanel": "Admin Panel",
      "Users": "Users",
      "AuditLogs": "Audit Logs",
      "SignOut": "Sign Out",
      "Welcome": "Hello, {{name}}",
      
      // Labels & Buttons
      "Search": "Search...",
      "SearchPlaceholder": "Search accounts, vouchers, mobile...",
      "Date": "Date",
      "Code": "Voucher No",
      "Account": "Account",
      "Debit": "Debit (Pay)",
      "Credit": "Credit (Rec)",
      "Balance": "Balance",
      "NetBalance": "Net Balance",
      "Cash": "Cash Balance",
      "Actions": "Actions",
      "Save": "Save",
      "Cancel": "Cancel",
      "Edit": "Edit",
      "Delete": "Delete",
      "Filter": "Filter",
      "All": "All",
      "AllBranches": "All Branches",
      "AllCurrencies": "All Currencies",
      "Print": "Print Statement",
      "ExportPDF": "Export PDF",
      "ShareWhatsApp": "Share WhatsApp",
      "AddEntry": "+ Add Entry",
      "RecentActivity": "Recent Activity",
      "BranchSummary": "Branch Summary",
      "FinancialSummary": "Financial Summary",
      "TotalAccounts": "Total Customers",
      "TotalVouchers": "Total Vouchers",
      "PKRBalance": "PKR Balance",
      "AEDBalance": "AED Balance",
      "USDBalance": "USD Balance",
      "ViewAll": "View All",

      // Ledger & Account Details
      "CustomerDetails": "Customer Details",
      "LedgerStatement": "Ledger Statement",
      "AccountNo": "Account No",
      "Mobile": "Mobile Number",
      "Address": "Address",
      "Currency": "Currency",
      "Branch": "Branch",
      "Narration": "Narration / Details",
      "Notes": "Notes",
      "OpeningBalance": "Opening Balance",
      "ClosingBalance": "Closing Balance",
      "Receipt": "Receipt (Jama)",
      "Payment": "Payment (Bnam)",
    }
  },
  ur: {
    translation: {
      // Navigation
      "Dashboard": "ڈیش بورڈ",
      "Accounts": "کسٹمر کھاتے",
      "Transactions": "لین دین / واؤچر",
      "Expenses": "اخراجات",
      "Reports": "رپورٹس",
      "Settings": "سیٹنگز",
      "PayablesReceivables": "لینا / دینا (گوشوارہ)",
      "Payables": "قابلِ ادائیگی (دینا ہے)",
      "Receivables": "قابلِ وصول (لینا ہے)",
      "TotalPayable": "کل دینا ہے",
      "TotalReceivable": "کل لینا ہے",
      "NewAccount": "نیا کسٹمر شامل کریں",
      "NewTransaction": "نئی انٹری شامل کریں",
      "Branches": "برانچز",
      "AdminPanel": "ایڈمن پینل",
      "Users": "صارفین",
      "AuditLogs": "آڈٹ لاگز",

      // Labels & Buttons
      "Search": "تلاش کریں...",
      "SearchPlaceholder": "کھاتہ، واؤچر نمبر، فون تلاش کریں...",
      "Date": "تاریخ",
      "Code": "واؤچر نمبر",
      "Account": "کھاتہ",
      "Debit": "بنام (ڈیبٹ)",
      "Credit": "جمع (کریڈٹ)",
      "Balance": "بقایا",
      "NetBalance": "کل صافی بقایا",
      "Cash": "نقد رقم (کیش)",
      "Actions": "اقدامات",
      "Save": "محفوظ کریں",
      "Cancel": "منسوخ",
      "Edit": "ترمیم",
      "Delete": "حذف کریں",
      "Filter": "فلٹر",
      "All": "تمام",
      "AllBranches": "تمام برانچز",
      "AllCurrencies": "تمام کرنسیاں",
      "Print": "پرنٹ کریں",
      "ExportPDF": "پی ڈی ایف (PDF)",
      "ShareWhatsApp": "واٹس ایپ شیئر",
      "AddEntry": "+ نئی انٹری",
      "RecentActivity": "حالیہ انٹریز (ایکٹیویٹی)",
      "BranchSummary": "برانچ خلاصہ",
      "FinancialSummary": "مالیاتی خلاصہ",
      "TotalAccounts": "کل کسٹمرز",
      "TotalVouchers": "کل واؤچرز",
      "PKRBalance": "پاکستان روپیہ (PKR)",
      "AEDBalance": "اماراتی درہم (AED)",
      "USDBalance": "امریکی ڈالر (USD)",
      "ViewAll": "سب دیکھیں",

      // Ledger & Account Details
      "CustomerDetails": "کسٹمر تفصیلات",
      "LedgerStatement": "کھاتہ اسٹیٹمنٹ",
      "AccountNo": "کھاتہ نمبر",
      "Mobile": "موبائل نمبر",
      "Address": "پتہ",
      "Currency": "کرنسی",
      "Branch": "برانچ",
      "Narration": "تفصیل / شرح",
      "Notes": "نوٹس",
      "OpeningBalance": "ابتدائی بقایا",
      "ClosingBalance": "آخری بقایا",
      "Receipt": "وصولی (جمع)",
      "Payment": "ادائیگی (بنام)",

      // Settings & Profile
      "Profile": "پروفائل",
      "Business": "کاروبار",
      "Preferences": "ترجیحات",
      "Security": "سیکیورٹی",
      "ProfileInfo": "پروفائل معلومات",
      "BusinessDetails": "کاروباری تفصیلات",
      "GeneralPreferences": "عام ترجیحات",
      "AccountSecurity": "اکاؤنٹ سیکیورٹی",
      "SessionManagement": "سیشن انتظامیہ",
      "FullName": "پورا نام",
      "BusinessName": "کاروبار کا نام",
      "BusinessPhone": "کاروباری فون نمبر",
      "BusinessAddress": "کاروباری پتہ",
      "NewPassword": "نیا پاس ورڈ",
      "ConfirmPassword": "پاس ورڈ کی تصدیق",
      "UpdatePassword": "پاس ورڈ اپ ڈیٹ کریں",
      "Theme": "تھیم",
    }
  }
};

const updateDir = (lng: string) => {
  if (typeof document !== "undefined") {
    document.documentElement.dir = lng === "ur" ? "rtl" : "ltr";
    document.documentElement.lang = lng;
    localStorage.setItem("app_lang", lng);
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLang,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false
    },
    react: {
      useSuspense: false
    }
  });

updateDir(savedLang);

i18n.on("languageChanged", (lng) => {
  updateDir(lng);
});

export default i18n;
