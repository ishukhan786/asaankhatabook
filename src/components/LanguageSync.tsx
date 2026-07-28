import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export default function LanguageSync() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const isUrdu = i18n.language?.startsWith("ur");
    const dir = isUrdu ? "rtl" : "ltr";
    document.documentElement.dir = dir;
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return null;
}
