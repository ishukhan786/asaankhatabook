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
      "Dashboard": "Dashboard",
      "Accounts": "Khate / Customers",
      "Transactions": "Transactions / Entry",
      "Expenses": "Kharchay / Expenses",
      "Reports": "Reports",
      "Settings": "Settings",
      "PayablesReceivables": "Lena / Dena (Goshwara)",
      "Payables": "Payables (Dena Hai)",
      "Receivables": "Receivables (Lena Hai)",
      "TotalPayable": "Kul Dena Hai",
      "TotalReceivable": "Kul Lena Hai",
      "NewAccount": "Naya Customer Shamil Karein",
      "NewTransaction": "Nayi Entry Shamil Karein",
      "Branches": "Branches",
      "AdminPanel": "Admin Panel",
      "Users": "Users",
      "AuditLogs": "Audit Logs",

      // Labels & Buttons
      "Search": "Talaash karein...",
      "SearchPlaceholder": "Khata, voucher number, phone talaash karein...",
      "Date": "Tareekh",
      "Code": "Voucher Number",
      "Account": "Khata",
      "Debit": "Banam (Debit / Nikala)",
      "Credit": "Jama (Credit)",
      "Balance": "Baqaya",
      "NetBalance": "Kul Saafi Baqaya",
      "Cash": "Cash Balance",
      "Actions": "Actions",
      "Save": "Save Karein",
      "Cancel": "Cancel",
      "Edit": "Edit",
      "Delete": "Delete Karein",
      "Filter": "Filter",
      "All": "Tamam",
      "AllBranches": "Tamam Branches",
      "AllCurrencies": "Tamam Currencies",
      "Print": "Print Statement",
      "ExportPDF": "PDF Export",
      "ShareWhatsApp": "WhatsApp Share",
      "AddEntry": "+ Nayi Entry",
      "RecentActivity": "Haliya Activities",
      "BranchSummary": "Branch Khulasa",
      "FinancialSummary": "Maliati Khulasa",
      "TotalAccounts": "Kul Customers",
      "TotalVouchers": "Kul Vouchers",
      "PKRBalance": "PKR Baqaya",
      "AEDBalance": "AED Baqaya",
      "USDBalance": "USD Baqaya",
      "ViewAll": "Sab Dekhein",

      // Ledger & Account Details
      "CustomerDetails": "Customer Tafseelat",
      "LedgerStatement": "Khata Statement",
      "AccountNo": "Khata Number",
      "Mobile": "Mobile Number",
      "Address": "Pata / Address",
      "Currency": "Currency",
      "Branch": "Branch",
      "Narration": "Tafseel / Narration",
      "Notes": "Notes",
      "OpeningBalance": "Ibtidai Baqaya",
      "ClosingBalance": "Akhri Baqaya",
      "Receipt": "Wasooli (Jama)",
      "Payment": "Adaigi (Banam)",

      // Settings & Profile
      "Profile": "Profile",
      "Business": "Business",
      "Preferences": "Tarjeehat / Preferences",
      "Security": "Security",
      "ProfileInfo": "Profile Tafseelat",
      "BusinessDetails": "Business Tafseelat",
      "GeneralPreferences": "Aam Tarjeehat",
      "AccountSecurity": "Account Security",
      "SessionManagement": "Session Management",
      "FullName": "Pura Naam",
      "BusinessName": "Business Naam",
      "BusinessPhone": "Business Phone No",
      "BusinessAddress": "Business Address",
      "NewPassword": "Naya Password",
      "ConfirmPassword": "Password Ki Tasdeeq",
      "UpdatePassword": "Password Update Karein",
      "Theme": "Theme",
    }
  }
};

const updateDir = (lng: string) => {
  if (typeof document !== "undefined") {
    // Keep Left-to-Right layout for Roman Urdu
    document.documentElement.dir = "ltr";
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
