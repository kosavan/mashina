import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "./context";
import { api } from "./api";
import { tr } from "./i18n";
import { Button } from "./components/ui/button";

export type HistoryMapping = {
  columns: Record<string, string>;
  default_kind: string | null;
  date_format: "iso" | "dmy";
  default_currency: string;
};
export type BankMapping = {
  date: string;
  amount: string;
  description: string;
  transaction_id: string | null;
  currency: string | null;
  date_format: "iso" | "russian";
  outgoing_sign: "negative" | "positive";
  default_currency: string;
};
export type BankEncoding = "utf-8" | "cp1251";
export type BankDelimiter = "comma" | "semicolon" | "tab";
type Template =
  | { kind: "history"; mapping: HistoryMapping }
  | {
      kind: "bank";
      mapping: BankMapping;
      encoding: BankEncoding;
      delimiter: BankDelimiter;
    };
type Profile = Template & { id: string; name: string };

export function ImportProfiles({
  kind,
  current,
  disabled,
  accepts,
  onApply,
}: {
  kind: Template["kind"];
  current?: Template;
  disabled: boolean;
  accepts: (profile: Profile) => boolean;
  onApply: (profile: Profile) => void;
}) {
  const { session, notify } = useApp();
  const client = useQueryClient();
  const queryKey = ["import-profiles", session.id, kind];
  const query = useQuery({
    queryKey,
    queryFn: () => api<Profile[]>(`/import/profiles?kind=${kind}`),
    retry: false,
  });
  const profiles = query.data || [];
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = profiles.find((profile) => profile.id === id);

  async function change(remove: boolean) {
    if (remove && !selected) return;
    if (!remove && (!current || !name.trim())) return;
    setBusy(true);
    setError("");
    try {
      if (remove && selected) {
        await api(
          `/import/profiles/${selected.id}`,
          { method: "DELETE" },
          session.csrf,
        );
        setId("");
        setName("");
      } else {
        const profile = await api<Profile>(
          "/import/profiles",
          {
            method: "POST",
            body: JSON.stringify({ ...current, name: name.trim() }),
          },
          session.csrf,
        );
        setId(profile.id);
        setName(profile.name);
        notify(tr("Шаблон импорта сохранён"));
      }
      await client.invalidateQueries({ queryKey });
    } catch (failure) {
      setError(tr((failure as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="import-profiles">
      <div className="field-grid">
        <label className="field">
          <span>{tr("Шаблоны импорта")}</span>
          <select
            aria-label={tr("Шаблоны импорта")}
            disabled={disabled || busy || !profiles.length}
            value={selected?.id || ""}
            onChange={(event) => {
              const profile = profiles.find(
                (row) => row.id === event.target.value,
              );
              setId(profile?.id || "");
              setName(profile?.name || "");
              setError("");
            }}
          >
            <option value="">{tr("Выберите шаблон импорта")}</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{tr("Название шаблона")}</span>
          <input
            aria-label={tr("Название шаблона")}
            maxLength={80}
            value={name}
            disabled={disabled || busy || !current}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
      </div>
      <div className="intake-actions">
        <Button
          type="button"
          variant="outline"
          disabled={disabled || busy || !selected || !accepts(selected)}
          onClick={() => selected && onApply(selected)}
        >
          {tr("Применить шаблон")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || busy || !current || !name.trim()}
          onClick={() => {
            if (
              profiles.some(
                (item) => item.name.toLowerCase() === name.trim().toLowerCase(),
              ) &&
              !confirm(tr("Заменить сохранённый шаблон?"))
            )
              return;
            void change(false);
          }}
        >
          {tr("Сохранить шаблон")}
        </Button>
        {selected && (
          <Button
            type="button"
            variant="ghost"
            disabled={disabled || busy}
            onClick={() => {
              if (confirm(tr("Удалить шаблон импорта?"))) void change(true);
            }}
          >
            {tr("Удалить шаблон")}
          </Button>
        )}
      </div>
      {selected && !accepts(selected) && (
        <p className="field-help">{tr("Столбцы шаблона не совпадают с CSV")}</p>
      )}
      {query.isLoading && <p role="status">{tr("Загрузка…")}</p>}
      {(error || query.isError) && (
        <p role="alert" className="error">
          {error || tr("Не удалось загрузить шаблоны импорта")}
        </p>
      )}
    </section>
  );
}
