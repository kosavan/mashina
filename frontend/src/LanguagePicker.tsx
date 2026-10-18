import {
  getLocale,
  setLocale,
  tr,
  useLocale,
  localeInfo,
  type Locale,
} from "./i18n";
import { useState } from "react";

export function LanguagePicker({
  onChange,
}: {
  onChange?: (locale: Locale) => void;
}) {
  useLocale();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <label className="language-picker">
      <span>{tr("Язык приложения")}</span>
      <select
        aria-label="Язык / Language"
        value={getLocale()}
        disabled={loading}
        onChange={async (event) => {
          const value = event.target.value as Locale;
          setLoading(true);
          setFailed(false);
          try {
            await setLocale(value);
            if (getLocale() === value) onChange?.(value);
          } catch {
            setFailed(true);
          } finally {
            setLoading(false);
          }
        }}
      >
        {Object.entries(localeInfo).map(([locale, info]) => (
          <option key={locale} value={locale} lang={locale}>
            {info.name}
          </option>
        ))}
      </select>
      {failed && (
        <small role="alert">
          {tr("Сервер недоступен. Проверьте соединение.")}
        </small>
      )}
    </label>
  );
}
