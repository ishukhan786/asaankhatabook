import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: {
    translation: {
      "Dashboard": "Dashboard",
      "Accounts": "Accounts",
      "Transactions": "Transactions",
      "Expenses": "Expenses",
      "Reports": "Reports",
      "Settings": "Settings",
      "PayablesReceivables": "Payables & Receivables",
      "Payables": "Payables",
      "Receivables": "Receivables",
      "TotalPayable": "Total Payable",
      "TotalReceivable": "Total Receivable",
      "NewAccount": "New Account",
      "NewTransaction": "New Transaction",
      "Branches": "Branches",
      "AdminPanel": "Admin Panel",
      "Users": "Users",
      "AuditLogs": "Audit Logs",
      "SignOut": "Sign Out",
      "Welcome": "Hello, {{name}}",
      "NetBalance": "Net Balance",
      "RecentTransactions": "Recent Transactions",
      "Lenedari": "Lenedari (You owe them)",
      "Denedari": "Denedari (Others owe you)",
      "Search": "Search",
      "Date": "Date",
      "Code": "Code",
      "Account": "Account",
      "Debit": "Debit",
      "Credit": "Credit",
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "en",
    fallbackLng: "en",
    interpolation: {
      escapeValue: false
    },
    react: {
      useSuspense: false
    }
  });

export default i18n;
