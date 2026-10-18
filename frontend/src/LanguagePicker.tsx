import { getLocale, setLocale, tr, useLocale, type Locale } from "./i18n";

export function LanguagePicker({
  onChange,
}: {
  onChange?: (locale: Locale) => void;
}) {
  useLocale();
  return (
    <label className="language-picker">
      <span>{tr("Язык приложения")}</span>
      <select
        aria-label="Язык / Language"
        value={getLocale()}
        onChange={(event) => {
          const value = event.target.value as Locale;
          setLocale(value);
          onChange?.(value);
        }}
      >
        <option value="ru" lang="ru">
          Русский
        </option>
        <option value="en" lang="en">
          English
        </option>
        <option value="de" lang="de">
          Deutsch
        </option>
      </select>
    </label>
  );
}
