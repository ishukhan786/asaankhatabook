import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

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
  },
  ur: {
    translation: {
      "Dashboard": "ڈیش بورڈ",
      "Accounts": "اکاؤنٹس",
      "Transactions": "لین دین",
      "Expenses": "اخراجات",
      "Reports": "رپورٹس",
      "Settings": "سیٹنگز",
      "PayablesReceivables": "واجبات اور وصولیاں",
      "Payables": "واجب الادا (لینے والے)",
      "Receivables": "واجب الوصول (دینے والے)",
      "TotalPayable": "کل واجب الادا (لینداری)",
      "TotalReceivable": "کل واجب الوصول (دینداری)",
      "NewAccount": "نیا اکاؤنٹ",
      "NewTransaction": "نیا لین دین",
      "Branches": "برانچیں",
      "AdminPanel": "ایڈمن پینل",
      "Users": "صارفین",
      "AuditLogs": "آڈٹ لاگز",
      "SignOut": "لاگ آؤٹ",
      "Welcome": "سلام، {{name}}",
      "NetBalance": "کل بیلنس",
      "RecentTransactions": "حالیہ لین دین",
      "Lenedari": "لینداری (آپ نے دینے ہیں)",
      "Denedari": "دینداری (لوگوں نے دینے ہیں)",
      "Search": "تلاش کریں",
      "Date": "تاریخ",
      "Code": "کوڈ",
      "Account": "اکاؤنٹ",
      "Debit": "ڈیبٹ",
      "Credit": "کریڈٹ",
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
