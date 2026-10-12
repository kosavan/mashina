import { useId } from "react";
import type { BodyDamage, BodyView } from "./types";
import {
  panels,
  pointForPanel,
  viewLabels,
  type PanelShape,
} from "./bodyGeometry";
import { tr } from "./i18n";

export function BodyDiagram({
  view,
  records = [],
  activeId,
  selectedPanel,
  point,
  onPanel,
  onRecord,
}: {
  view: BodyView;
  records?: BodyDamage[];
  activeId?: string;
  selectedPanel?: string;
  point?: { x: number; y: number };
  onPanel?: (panel: PanelShape, point: { x: number; y: number }) => void;
  onRecord?: (record: BodyDamage) => void;
}) {
  const gridId = useId();
  const paintId = useId();
  return (
    <div className={`body-canvas body-view-${view}`}>
      <svg
        viewBox="0 0 360 300"
        role={onPanel ? "group" : "img"}
        aria-label={tr("Схема кузова: {0}", [tr(viewLabels[view])])}
      >
        <defs>
          <linearGradient id={paintId} x1="0" y1="0" x2="0.25" y2="1">
            <stop offset="0" stopColor="var(--body-highlight)" />
            <stop offset="1" stopColor="var(--body-shadow)" />
          </linearGradient>
          <pattern
            id={gridId}
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r=".6" fill="currentColor" opacity=".18" />
          </pattern>
        </defs>
        <rect width="360" height="300" fill={`url(#${gridId})`} />
        <CarOutline view={view} paintId={paintId} />
        {panels[view].map((shape) => (
          <path
            key={shape.id}
            d={shape.path}
            fill={`url(#${paintId})`}
            className={`body-panel ${shape.glass ? "body-glass" : ""} ${selectedPanel === shape.id ? "selected" : ""}`}
            role={onPanel ? "button" : undefined}
            tabIndex={onPanel ? 0 : undefined}
            aria-label={tr(shape.label)}
            aria-pressed={onPanel ? selectedPanel === shape.id : undefined}
            onClick={(event) => {
              if (!onPanel) return;
              const matrix =
                event.currentTarget.ownerSVGElement?.getScreenCTM();
              if (!matrix) return;
              const p = new DOMPoint(
                event.clientX,
                event.clientY,
              ).matrixTransform(matrix.inverse());
              onPanel(shape, {
                x: Math.max(0, Math.min(1, p.x / 360)),
                y: Math.max(0, Math.min(1, p.y / 300)),
              });
            }}
            onKeyDown={(event) => {
              if (onPanel && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                onPanel(shape, pointForPanel(shape));
              }
            }}
          >
            <title>{tr(shape.label)}</title>
          </path>
        ))}
        <CarDetails view={view} />
      </svg>
      {records
        .filter((r) => r.view === view && onRecord)
        .map((record, index) => (
          <button
            type="button"
            key={record.id}
            className={`body-marker body-status-${record.status} ${activeId === record.id ? "active" : ""}`}
            style={{ left: `${record.x * 100}%`, top: `${record.y * 100}%` }}
            aria-label={tr("Открыть повреждение: {0}", [record.title])}
            onClick={() => onRecord?.(record)}
          >
            <span>{index + 1}</span>
          </button>
        ))}
      {point && (
        <span
          className="body-placement"
          aria-hidden="true"
          style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
        >
          <span />
        </span>
      )}
    </div>
  );
}

function CarOutline({ view, paintId }: { view: BodyView; paintId: string }) {
  const paint = `url(#${paintId})`;
  if (view === "left" || view === "right")
    return (
      <g aria-hidden="true" className="body-illustration">
        <ellipse className="body-ground" cx="180" cy="233" rx="154" ry="3" />
        {[73, 289].map((cx) => (
          <g key={cx} className="body-wheel">
            <circle cx={cx} cy="201" r="24" className="body-tire" />
            <circle cx={cx} cy="201" r="17" className="body-rim" />
            <circle cx={cx} cy="201" r="4" />
            {[0, 72, 144, 216, 288].map((angle) => (
              <path
                key={angle}
                d={`M${cx - 3} 195L${cx - 8} 187L${cx + 2} 187L${cx + 4} 195Z`}
                transform={`rotate(${angle} ${cx} 201)`}
              />
            ))}
          </g>
        ))}
        <path
          className="body-shell"
          fill={paint}
          d="M18 181L21 160Q23 151 36 148L102 134Q131 104 152 96Q195 82 229 99Q251 110 270 133L321 145Q335 149 339 163L342 187L336 207L316 212Q319 199 310 184Q303 174 289 174Q263 174 261 212L102 212Q103 192 92 181Q84 174 73 174Q49 174 45 209L24 204Q18 200 18 181Z"
        />
        <path
          className="body-contour"
          d="M29 153Q69 144 103 140M124 135Q195 127 268 138M268 138Q309 144 334 157M113 201L255 201"
        />
      </g>
    );
  if (view === "top")
    return (
      <g aria-hidden="true" className="body-illustration">
        <g className="body-tire">
          <rect x="103" y="60" width="13" height="39" rx="5" />
          <rect x="244" y="60" width="13" height="39" rx="5" />
          <rect x="103" y="213" width="13" height="39" rx="5" />
          <rect x="244" y="213" width="13" height="39" rx="5" />
        </g>
        <path
          className="body-shell"
          fill={paint}
          d="M125 28Q180 10 235 28Q248 42 250 73L253 231Q252 262 240 274Q180 291 120 274Q108 262 107 231L110 73Q112 42 125 28Z"
        />
        <path
          className="body-shell"
          fill={paint}
          d="M111 102Q98 99 96 107L97 116L111 119M249 102Q262 99 264 107L263 116L249 119"
        />
        <path
          className="body-contour"
          d="M116 43L113 77M244 43L247 77M113 238L118 264M247 238L242 264"
        />
      </g>
    );
  return (
    <g aria-hidden="true" className="body-illustration">
      <ellipse className="body-ground" cx="180" cy="256" rx="141" ry="3" />
      <g className="body-tire">
        <rect x="48" y="211" width="27" height="37" rx="7" />
        <rect x="285" y="211" width="27" height="37" rx="7" />
      </g>
      <path
        className="body-shell"
        fill={paint}
        d="M95 78Q180 58 265 78L285 130Q303 140 311 163Q319 181 315 220L310 239Q180 258 50 239L45 220Q41 181 49 163Q57 140 75 130Z"
      />
      <path
        className="body-shell"
        fill={paint}
        d="M76 125L59 121Q47 120 46 128L48 136L74 139M284 125L301 121Q313 120 314 128L312 136L286 139"
      />
    </g>
  );
}
function CarDetails({ view }: { view: BodyView }) {
  if (view === "left" || view === "right")
    return (
      <g className="body-detail-line" aria-hidden="true">
        <path d="M190 97L191 129M197 99L198 129M151 102L119 128M228 107L249 131M117 144Q183 137 257 145M158 145L172 145M227 146L240 146M119 198L252 198M26 162L45 157L44 164L25 170M325 156L336 159L337 167L326 164" />
        <path className="body-light" d="M25 161L43 157M328 158L336 161" />
        <path d="M113 207L253 207M319 198L334 195M22 190L36 192" />
      </g>
    );
  if (view === "top")
    return (
      <g className="body-detail-line" aria-hidden="true">
        <path
          className="body-window"
          d="M116 104L126 130L125 185L116 216Q111 158 116 104ZM244 104L234 130L235 185L244 216Q249 158 244 104Z"
        />
        <path d="M113 160L125 160M235 160L247 160M139 41L134 75M221 41L226 75M134 244L137 263M226 244L223 263" />
        <path
          className="body-light"
          d="M121 34L122 47M239 34L238 47M124 270Q180 285 236 270"
        />
      </g>
    );
  return (
    <g className="body-detail-line" aria-hidden="true">
      {view === "front" ? (
        <>
          <path d="M108 143L123 168M252 143L237 168M139 180L221 180L213 198L147 198ZM63 218L98 220L93 232L62 229M297 218L262 220L267 232L298 229M111 233Q180 240 249 233" />
          <path className="body-light" d="M56 179L108 185M252 185L304 179" />
          <path d="M155 185L205 185M158 190L202 190M163 195L197 195" />
        </>
      ) : (
        <>
          <path className="body-light" d="M57 183L124 190L236 190L303 183" />
          <path d="M143 199L217 199L215 215L145 215ZM67 223L92 226M268 226L293 223M105 235Q180 242 255 235M148 204L212 204" />
        </>
      )}
    </g>
  );
}
