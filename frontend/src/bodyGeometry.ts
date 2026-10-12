import type { BodyDamage, BodyView, DamageStatus } from "./types";

export const viewLabels: Record<BodyView, string> = {
  front: "Спереди",
  rear: "Сзади",
  left: "Слева",
  right: "Справа",
  top: "Сверху",
};
export const statusLabels: Record<DamageStatus, string> = {
  observed: "Замечено",
  needs_repair: "Требует ремонта",
  planned: "Запланировано",
  repaired: "Устранено",
  monitoring: "Наблюдать",
};
export const typeLabels: Record<BodyDamage["damage_type"], string> = {
  scratch: "Царапина",
  dent: "Вмятина",
  chip: "Скол",
  corrosion: "Коррозия",
  crack: "Трещина",
  other: "Другое",
};
export const severityLabels: Record<BodyDamage["severity"], string> = {
  minor: "Небольшое",
  moderate: "Заметное",
  major: "Серьёзное",
};
export interface PanelShape {
  id: string;
  label: string;
  path: string;
  x: number;
  y: number;
  glass?: boolean;
}
const panel = (
  id: string,
  label: string,
  path: string,
  x: number,
  y: number,
  glass = false,
): PanelShape => ({ id, label, path, x, y, glass });
const sidePanels = (side: "left" | "right"): PanelShape[] => [
  panel(
    `${side}_front_fender`,
    "Переднее крыло",
    "M25 156Q57 140 106 137L109 176Q102 178 100 190Q97 172 73 171Q48 171 43 197L23 194Q18 178 25 156Z",
    65,
    156,
  ),
  panel(
    `${side}_front_door`,
    "Передняя дверь",
    "M110 139L192 137L190 202L107 202Q111 188 110 139Z",
    150,
    165,
  ),
  panel(
    `${side}_rear_door`,
    "Задняя дверь",
    "M197 137Q231 137 258 142L267 172Q259 185 258 202L195 202Z",
    227,
    167,
  ),
  panel(
    `${side}_rear_fender`,
    "Заднее крыло",
    "M261 141Q304 142 332 153L337 179L335 194L318 197Q315 172 289 171Q278 171 270 176Z",
    299,
    156,
  ),
  panel(
    `${side}_sill`,
    "Порог кузова",
    "M108 207L258 207L256 214Q188 219 110 214Z",
    185,
    211,
  ),
  panel(
    `${side}_glass`,
    "Боковое остекление",
    "M111 130Q136 103 154 99Q196 89 225 103Q247 115 260 133Q187 127 111 130Z",
    186,
    114,
    true,
  ),
  panel(
    `${side}_mirror`,
    "Зеркало",
    "M107 129Q103 121 111 121L124 124L127 131L117 135Z",
    116,
    128,
  ),
];
export const panels: Record<BodyView, PanelShape[]> = {
  left: sidePanels("left"),
  right: sidePanels("right"),
  front: [
    panel(
      "windshield",
      "Лобовое стекло",
      "M105 84Q180 66 255 84L276 134Q180 126 84 134Z",
      180,
      107,
      true,
    ),
    panel(
      "hood",
      "Капот",
      "M81 140Q180 129 279 140L300 171Q180 188 60 171Z",
      180,
      154,
    ),
    panel(
      "front_bumper",
      "Передний бампер",
      "M51 203Q180 217 309 203L307 232Q180 252 53 232Z",
      180,
      228,
    ),
    panel(
      "left_headlight",
      "Левая фара",
      "M247 182L308 174L306 187L250 194Z",
      279,
      185,
    ),
    panel(
      "right_headlight",
      "Правая фара",
      "M52 174L113 182L110 194L54 187Z",
      81,
      185,
    ),
  ],
  rear: [
    panel(
      "rear_glass",
      "Заднее стекло",
      "M104 83Q180 69 256 83L275 129Q180 121 85 129Z",
      180,
      106,
      true,
    ),
    panel(
      "trunk",
      "Крышка багажника",
      "M80 135Q180 127 280 135L296 172Q180 183 64 172Z",
      180,
      151,
    ),
    panel(
      "rear_bumper",
      "Задний бампер",
      "M51 202Q180 212 309 202L307 231Q180 251 53 231Z",
      180,
      226,
    ),
    panel(
      "left_taillight",
      "Левый фонарь",
      "M52 177L123 185L123 195L54 187Z",
      86,
      186,
    ),
    panel(
      "right_taillight",
      "Правый фонарь",
      "M237 185L308 177L306 187L237 195Z",
      274,
      186,
    ),
  ],
  top: [
    panel(
      "hood",
      "Капот",
      "M126 36Q180 18 234 36L242 85Q180 74 118 85Z",
      180,
      57,
    ),
    panel(
      "windshield",
      "Лобовое стекло",
      "M119 91Q180 78 241 91L228 125Q180 115 132 125Z",
      180,
      104,
      true,
    ),
    panel(
      "roof",
      "Крыша",
      "M134 131Q180 123 226 131L228 185Q180 194 132 185Z",
      180,
      157,
    ),
    panel(
      "rear_glass",
      "Заднее стекло",
      "M132 191Q180 201 228 191L240 222Q180 232 120 222Z",
      180,
      210,
      true,
    ),
    panel(
      "trunk",
      "Крышка багажника",
      "M120 228Q180 239 240 228L235 263Q180 280 125 263Z",
      180,
      252,
    ),
  ],
};
export const pointForPanel = (shape: PanelShape) => ({
  x: shape.x / 360,
  y: shape.y / 300,
});
export function panelLabel(record: Pick<BodyDamage, "view" | "panel">) {
  return (
    panels[record.view]?.find((p) => p.id === record.panel)?.label ||
    record.panel
  );
}
export function visibleDamages(
  rows: BodyDamage[],
  vehicleId: string,
  filter: string,
) {
  return rows
    .filter(
      (r) =>
        !r.deleted &&
        r.vehicle_id === vehicleId &&
        (filter === "all" ||
          (filter === "unresolved"
            ? r.status !== "repaired"
            : r.status === filter)),
    )
    .sort(
      (a, b) =>
        b.discovered_on.localeCompare(a.discovered_on) ||
        a.id.localeCompare(b.id),
    );
}
