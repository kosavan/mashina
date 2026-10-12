import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  ChartNoAxesCombined,
  ArrowUpRight,
  Fuel,
  Gauge,
  Wallet,
  Info,
} from "lucide-react";
import { useApp } from "./context";
import { cachedAPI } from "./offline";
import { PageHeading, Metric } from "./Views";
import { categories, money, number, today } from "./utils";
type Data = {
  total_minor: number;
  fuel_minor: number;
  maintenance_minor: number;
  mileage: number | null;
  cost_per_km: number | null;
  average_month_minor: number;
  average_year_minor: number;
  consumption: number | null;
  average_liter_price: number | null;
  fuel_cost_per_km: number | null;
  purchase_minor: number;
  sale_minor: number;
  ownership_minor: number;
  months: any[];
  categories: any[];
  years: any[];
  cars: any[];
  cycles: any[];
  fuel_prices: any[];
  missing_reason: string;
  currency: string;
  cost_trend?: any[];
};
const colors = [
  "#c1ee79",
  "#84a961",
  "#597548",
  "#343f31",
  "#c4b78b",
  "#748a9a",
  "#b9c4a4",
  "#74876f",
  "#829583",
  "#a2aa92",
  "#c9c7b7",
  "#9b9f8a",
];
function ChartEmpty() {
  return (
    <div className="chart-no-data">
      <ChartNoAxesCombined size={26} />
      <span>Недостаточно данных для графика</span>
    </div>
  );
}
export default function Analytics({ fuel = false }: { fuel?: boolean }) {
  const { state, session, selected } = useApp();
  const [car, setCar] = useState(fuel ? selected : "");
  const [period, setPeriod] = useState(fuel ? "all" : "year");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [category, setCategory] = useState("");
  const [kind, setKind] = useState(fuel ? "fuel" : "");
  const [currency, setCurrency] = useState("RUB");
  const from =
    period === "year"
      ? today().slice(0, 4) + "-01-01"
      : period === "month"
        ? today().slice(0, 7) + "-01"
        : period === "custom"
          ? start
          : "";
  const to = period === "custom" ? end : "";
  const params = new URLSearchParams({
    vehicle_id: car,
    start: from,
    end: to,
    category,
    kind,
    currency,
  });
  const query = useQuery({
    queryKey: ["analytics", session.id, params.toString(), state.events],
    queryFn: () => cachedAPI<Data>(session, "/analytics?" + params),
  });
  const d = query.data;
  const tooltip = {
    contentStyle: {
      background: "var(--panel)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      color: "var(--text)",
    },
    labelStyle: { color: "var(--muted)" },
    formatter: (value: any) => number(Number(value), 2),
  };
  const axis = {
    stroke: "var(--muted)",
    fontSize: 11,
    tickLine: false,
    axisLine: false,
  };
  return (
    <>
      <PageHeading
        eyebrow="ЦИФРЫ СТАНОВЯТСЯ ПОНЯТНЕЕ"
        title="Аналитика"
        description="Понимайте стоимость каждой поездки и картину целиком."
      />
      <div className="analytics-filters">
        <select
          aria-label="Автомобиль аналитики"
          value={car}
          onChange={(e) => setCar(e.target.value)}
        >
          <option value="">Все автомобили</option>
          {state.vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <div className="segmented">
          {[
            ["month", "Месяц"],
            ["year", "Год"],
            ["all", "Всё время"],
            ["custom", "Период"],
          ].map(([k, v]) => (
            <button
              key={k}
              className={period === k ? "active" : ""}
              onClick={() => setPeriod(k)}
            >
              {v}
            </button>
          ))}
        </div>
        <select
          aria-label="Валюта аналитики"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
        >
          {Array.from(
            new Set(["RUB", ...state.events.map((e) => e.currency)]),
          ).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="filters compact">
        <select
          aria-label="Категория аналитики"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Все категории</option>
          {[
            ...categories,
            ...state.categories.filter((c) => !c.deleted).map((c) => c.name),
          ].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          aria-label="Тип расходов"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="">Все расходы</option>
          <option value="fuel">Топливо</option>
          <option value="maintenance">Обслуживание</option>
          <option value="expense">Прочие расходы</option>
        </select>
        {period === "custom" && (
          <>
            <input
              aria-label="С даты"
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
            <input
              aria-label="До даты"
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </>
        )}
      </div>
      {query.isLoading ? (
        <div className="skeleton-panel" />
      ) : query.error ? (
        <div className="error-box" role="alert">
          {(query.error as Error).message}
          <button className="text-link" onClick={() => query.refetch()}>
            Повторить
          </button>
        </div>
      ) : (
        d && (
          <>
            <section className="analytics-metrics">
              <Metric
                label="Расходы за период"
                value={money(d.total_minor, currency)}
                icon={Wallet}
                detail="Только эксплуатационные затраты"
              />
              <Metric
                label="На топливо"
                value={money(d.fuel_minor, currency)}
                icon={Fuel}
                detail={
                  d.average_liter_price != null
                    ? `${number(d.average_liter_price, 2)} за литр в среднем`
                    : "Заправки появятся здесь"
                }
              />
              <Metric
                label="Стоимость километра"
                value={number(d.cost_per_km, 2)}
                unit={currency === "RUB" ? "₽/км" : currency + "/км"}
                icon={Gauge}
                detail={
                  d.cost_per_km == null
                    ? "Нужны подтверждённые показания"
                    : "По пробегу за период владения"
                }
              />
              <Metric
                label="В месяц в среднем"
                value={money(d.average_month_minor, currency)}
                icon={ArrowUpRight}
                detail="С учётом длительности периода"
              />
            </section>
            <div className="analytics-chart-grid">
              <section className="panel chart-panel chart-main">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">ДИНАМИКА</span>
                    <h3>Расходы по месяцам</h3>
                  </div>
                  <span className="chart-unit">{currency}</span>
                </div>
                {d.months.length ? (
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={d.months}
                        margin={{ left: 0, right: 10, top: 15, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="areaFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#b9e87a"
                              stopOpacity={0.25}
                            />
                            <stop
                              offset="100%"
                              stopColor="#b9e87a"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          stroke="var(--border)"
                          vertical={false}
                          strokeDasharray="3 4"
                        />
                        <XAxis dataKey="name" {...axis} />
                        <YAxis
                          {...axis}
                          width={55}
                          tickFormatter={(v) =>
                            v >= 1000 ? `${number(v / 1000)}к` : number(v)
                          }
                        />
                        <Tooltip {...tooltip} />
                        <Area
                          type="monotone"
                          dataKey="amount"
                          name="Расходы"
                          stroke="#b9e87a"
                          fill="url(#areaFill)"
                          strokeWidth={2.5}
                          activeDot={{ r: 5, fill: "#c5ef8b" }}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <ChartEmpty />
                )}
              </section>
              <section className="panel chart-panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">СТРУКТУРА</span>
                    <h3>Куда уходят деньги</h3>
                  </div>
                </div>
                {d.categories.length ? (
                  <>
                    <div className="donut-container">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={d.categories}
                            dataKey="amount"
                            nameKey="name"
                            innerRadius="66%"
                            outerRadius="88%"
                            paddingAngle={3}
                            stroke="none"
                            isAnimationActive={false}
                          >
                            {d.categories.map((_, i) => (
                              <Cell key={i} fill={colors[i % colors.length]} />
                            ))}
                          </Pie>
                          <Tooltip {...tooltip} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="donut-center">
                        <span>Всего</span>
                        <strong>{number(d.total_minor / 100)}</strong>
                        <small>{currency}</small>
                      </div>
                    </div>
                    <div className="chart-legend">
                      {d.categories.map((c, i) => (
                        <div key={c.name}>
                          <i
                            style={{ background: colors[i % colors.length] }}
                          />
                          <span>{c.name}</span>
                          <strong>
                            {money(Math.round(c.amount * 100), currency)}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <ChartEmpty />
                )}
              </section>
            </div>
            <div className="analytics-detail-strip">
              <div>
                <span>Пробег за период</span>
                <strong>
                  {number(d.mileage)} <small>км</small>
                </strong>
              </div>
              <div>
                <span>Ремонт и обслуживание</span>
                <strong>{money(d.maintenance_minor, currency)}</strong>
              </div>
              <div>
                <span>Среднегодовые расходы</span>
                <strong>{money(d.average_year_minor, currency)}</strong>
              </div>
            </div>
            {d.missing_reason && (
              <div className="info-box inline">
                <Info size={17} />
                {d.missing_reason}. Нулевой показатель не подставляется.
              </div>
            )}
            <section className="section-heading">
              <h3>Топливо в деталях</h3>
              <span className="tiny muted">
                Только завершённые достоверные циклы
              </span>
            </section>
            <section className="metrics-grid three">
              <Metric
                label="Средний расход"
                value={number(d.consumption, 2)}
                unit="л/100 км"
                detail={
                  d.consumption == null
                    ? "Нужны два полных бака без пропусков"
                    : "Полный бак → полный бак"
                }
              />
              <Metric
                label="Средняя цена литра"
                value={number(d.average_liter_price, 2)}
                unit={currency}
              />
              <Metric
                label="Топливо на километр"
                value={number(d.fuel_cost_per_km, 2)}
                unit={`${currency}/км`}
              />
            </section>
            <div className="analytics-chart-grid equal">
              <section className="panel chart-panel">
                <h3>Динамика расхода</h3>
                {d.cycles.length ? (
                  <div className="chart-container small">
                    <ResponsiveContainer>
                      <LineChart data={d.cycles}>
                        <CartesianGrid
                          stroke="var(--border)"
                          vertical={false}
                        />
                        <XAxis dataKey="date" {...axis} />
                        <YAxis {...axis} width={35} />
                        <Tooltip {...tooltip} />
                        <Line
                          dataKey="consumption"
                          name="л/100 км"
                          stroke="#b9e87a"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <ChartEmpty />
                )}
              </section>
              <section className="panel chart-panel">
                <h3>Цена литра топлива</h3>
                {d.fuel_prices.length ? (
                  <div className="chart-container small">
                    <ResponsiveContainer>
                      <LineChart data={d.fuel_prices}>
                        <CartesianGrid
                          stroke="var(--border)"
                          vertical={false}
                        />
                        <XAxis dataKey="date" {...axis} />
                        <YAxis {...axis} domain={["auto", "auto"]} width={35} />
                        <Tooltip {...tooltip} />
                        <Line
                          dataKey="price"
                          name={currency + "/л"}
                          stroke="#a4b5c9"
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <ChartEmpty />
                )}
              </section>
            </div>
            <div className="analytics-chart-grid equal">
              {[
                ["Сравнение автомобилей", d.cars],
                ["Сравнение годов", d.years],
              ].map(([title, data]) => (
                <section className="panel chart-panel" key={String(title)}>
                  <h3>{String(title)}</h3>
                  {(data as any[]).length ? (
                    <div className="chart-container small">
                      <ResponsiveContainer>
                        <BarChart data={data as any[]}>
                          <CartesianGrid
                            stroke="var(--border)"
                            vertical={false}
                          />
                          <XAxis dataKey="name" {...axis} />
                          <YAxis
                            {...axis}
                            width={55}
                            tickFormatter={(v) => number(v / 1000) + "к"}
                          />
                          <Tooltip {...tooltip} />
                          <Bar
                            dataKey="amount"
                            name="Расходы"
                            fill="#b9e87a"
                            radius={[5, 5, 0, 0]}
                            maxBarSize={75}
                            isAnimationActive={false}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <ChartEmpty />
                  )}
                </section>
              ))}
            </div>
            <section className="panel chart-panel">
              <h3>Динамика стоимости километра</h3>
              <p className="muted">
                Накопленные расходы и подтверждённый пробег с начала выбранного
                периода. Пробел означает недостаток показаний.
              </p>
              {d.cost_trend?.some((row) => row.cost !== null) ? (
                <div className="chart-container small">
                  <ResponsiveContainer>
                    <LineChart data={d.cost_trend}>
                      <CartesianGrid stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" {...axis} />
                      <YAxis {...axis} width={55} />
                      <Tooltip {...tooltip} />
                      <Line
                        dataKey="cost"
                        name={currency + "/км"}
                        stroke="#c1ee79"
                        dot={false}
                        strokeWidth={2}
                        isAnimationActive={false}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <ChartEmpty />
              )}
            </section>
            {d.cycles.length > 0 && (
              <section className="panel chart-panel">
                <h3>Расстояния между полными баками</h3>
                <div className="cycle-list">
                  {d.cycles.map((c, i) => (
                    <div key={i}>
                      <span>{c.date}</span>
                      <strong>{number(c.distance)} км</strong>
                      <span>{number(c.liters, 2)} л</span>
                      <span>{number(c.consumption, 2)} л/100 км</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <section className="panel ownership-panel">
              <div>
                <span className="eyebrow">
                  СТОИМОСТЬ ВЛАДЕНИЯ · ВЫБРАННЫЕ АВТОМОБИЛИ
                </span>
                <h3>Эксплуатация и капитал — отдельно</h3>
                <p className="muted">
                  Покупка и продажа не включены в эксплуатационные графики.
                  Изменение рыночной стоимости без оценки не рассчитывается.
                </p>
              </div>
              <dl>
                <div>
                  <dt>Покупка автомобилей</dt>
                  <dd>{money(d.purchase_minor, currency)}</dd>
                </div>
                <div>
                  <dt>Продажа автомобилей</dt>
                  <dd>{money(d.sale_minor, currency)}</dd>
                </div>
                <div>
                  <dt>Эксплуатация за выбранный период</dt>
                  <dd>{money(d.total_minor, currency)}</dd>
                </div>
                <div>
                  <dt>Покупка − продажа + выбранная эксплуатация</dt>
                  <dd>{money(d.ownership_minor, currency)}</dd>
                </div>
              </dl>
            </section>
          </>
        )
      )}
    </>
  );
}
