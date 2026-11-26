import { useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { useApp } from "./context";
import { tr } from "./i18n";
import {
  expiresInDays,
  inspectionLabels,
  renewalHistory,
  renewalLabels,
} from "./renewals";
import type { RenewalType } from "./types";
import { dateLabel, download, money, number, today } from "./utils";
import { Empty, EventRow, PageHeading, VehicleSelect } from "./Views";

const renewalOptions = [
  {
    kind: "registration",
    icon: ClipboardCheck,
    add: "Добавить регистрацию",
    reminder: "Продлить регистрацию",
  },
  {
    kind: "insurance",
    icon: ShieldCheck,
    add: "Добавить страховку",
    reminder: "Продлить страховку",
  },
] as const;
const pageSize = 30;

export default function Renewals() {
  const { state, selected, setSelected, open } = useApp();
  const [cursor, setCursor] = useState(0);
  const car =
    state.vehicles.find((vehicle) => vehicle.id === selected) ??
    state.vehicles[0];
  const rows = car ? renewalHistory(state.events, car.id) : [];
  const pageCount = Math.ceil(rows.length / pageSize);
  const page = Math.min(cursor, Math.max(0, pageCount - 1));
  const currentDay = today();

  function addRenewal(type: RenewalType) {
    if (!car) return;
    setSelected(car.id);
    open("expense", undefined, { renewalType: type });
  }

  return (
    <>
      <PageHeading
        eyebrow={tr("ДОКУМЕНТЫ")}
        title={tr("Регистрация и страховка")}
        description={tr(
          "Сроки действия, оплата и история продлений по автомобилю.",
        )}
      />
      {car ? (
        <>
          <div className="filters">
            <VehicleSelect
              value={car.id}
              onChange={(id) => {
                setSelected(id);
                setCursor(0);
              }}
            />
          </div>
          <div className="renewals-grid">
            {renewalOptions.map(({ kind, icon: Icon, add, reminder }) => {
              const latest = rows.find((entry) => entry.renewal.type === kind);
              const schedule = state.reminders.find(
                (record) =>
                  !record.deleted &&
                  record.vehicle_id === car.id &&
                  record.renewal_schedule?.type === kind,
              );
              const remaining = latest
                ? expiresInDays(latest.renewal.expires_on, currentDay)
                : null;
              const status =
                remaining == null
                  ? null
                  : remaining < 0
                    ? { label: "Срок истёк", tone: "overdue" }
                    : remaining === 0
                      ? { label: "Истекает сегодня", tone: "soon" }
                      : remaining <= 30
                        ? { label: "Скоро истекает", tone: "soon" }
                        : { label: "Действует", tone: "" };
              return (
                <article className="panel renewal-card" key={kind}>
                  <div className="renewal-header">
                    <span
                      className={`event-icon expense ${kind === "insurance" ? "insurance" : "government"}`}
                    >
                      <Icon size={21} aria-hidden="true" />
                    </span>
                    <h2>{tr(renewalLabels[kind])}</h2>
                    {status && (
                      <span className={`status-pill ${status.tone}`}>
                        {tr(status.label)}
                      </span>
                    )}
                  </div>
                  {latest ? (
                    <dl className="renewal-facts">
                      <div>
                        <dt>{tr("Действует до")}</dt>
                        <dd>
                          {dateLabel(latest.renewal.expires_on + "T12:00:00")}
                        </dd>
                      </div>
                      <div>
                        <dt>{tr("Последняя оплата")}</dt>
                        <dd>
                          {money(latest.amount_minor, latest.currency)}
                          <small>
                            {dateLabel(
                              latest.occurred_at.slice(0, 10) + "T12:00:00",
                            )}
                          </small>
                        </dd>
                      </div>
                      {kind === "registration" && (
                        <div>
                          <dt>{tr("Техосмотр")}</dt>
                          <dd>
                            {tr(
                              inspectionLabels[
                                latest.renewal.inspection_status ?? "pending"
                              ],
                            )}
                          </dd>
                        </div>
                      )}
                      {schedule?.enabled && (
                        <div>
                          <dt>{tr("Напоминания")}</dt>
                          <dd>
                            {tr("За {0} дн. до продления", [
                              schedule.renewal_schedule!.lead_days,
                            ])}
                          </dd>
                        </div>
                      )}
                    </dl>
                  ) : (
                    <p className="muted renewal-empty">
                      {tr("Пока нет записей")}
                    </p>
                  )}
                  <div className="renewal-actions">
                    <Button variant="outline" onClick={() => addRenewal(kind)}>
                      <Plus size={16} />
                      {tr(add)}
                    </Button>
                    {latest &&
                      remaining != null &&
                      (remaining >= 0 || schedule) &&
                      car.can_edit !== false && (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setSelected(car.id);
                            open("reminder", schedule, {
                              reminderDraft: {
                                title: tr(reminder),
                                due_date: latest.renewal.expires_on,
                                renewalType: kind,
                              },
                            });
                          }}
                        >
                          <Bell size={16} />
                          {tr(
                            schedule
                              ? "Настроить напоминание"
                              : "Напомнить о продлении",
                          )}
                        </Button>
                      )}
                    {latest && (
                      <Button
                        variant="ghost"
                        disabled={latest.pending || !navigator.onLine}
                        onClick={() =>
                          download(`/api/v1/renewals/${latest.id}/calendar`)
                        }
                      >
                        <CalendarDays size={16} />
                        {tr("Добавить в календарь")}
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          <div className="section-heading">
            <h2>{tr("История продлений")}</h2>
            {rows.length > 0 && (
              <span className="tiny muted">{number(rows.length)}</span>
            )}
          </div>
          <div className="panel timeline-panel">
            {rows.length ? (
              rows
                .slice(page * pageSize, (page + 1) * pageSize)
                .map((entry) => <EventRow entry={entry} key={entry.id} />)
            ) : (
              <Empty
                icon={ClipboardCheck}
                title={tr("Пока нет записей")}
                description={tr(
                  "Добавьте регистрацию или страховку, чтобы видеть расходы и даты продления.",
                )}
              />
            )}
          </div>
          {pageCount > 1 && (
            <div className="pagination">
              <Button
                variant="outline"
                disabled={page === 0}
                onClick={() => setCursor(page - 1)}
              >
                <ChevronLeft size={16} />
                {tr("Назад")}
              </Button>
              <span>
                {page + 1} / {pageCount}
              </span>
              <Button
                variant="outline"
                disabled={page + 1 >= pageCount}
                onClick={() => setCursor(page + 1)}
              >
                {tr("Далее")}
                <ChevronRight size={16} />
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="panel">
          <Empty
            title={tr("Сначала добавьте автомобиль в гараж.")}
            description={tr(
              "После этого можно сохранить регистрацию и страховку.",
            )}
            label={tr("Добавить автомобиль")}
            onClick={() => open("vehicle")}
          />
        </div>
      )}
    </>
  );
}
