import { useEffect, useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { tr } from "./i18n";
export function SuggestionField({
  name,
  label,
  value,
  options,
  onChange,
  onSelect = onChange,
  maxLength = 100,
}: {
  name?: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  onSelect?: (value: string) => void;
  maxLength?: number;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [active, setActive] = useState(-1);
  useEffect(() => {
    if (open && active >= 0)
      document
        .getElementById(id + "-" + active)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, id, open]);
  const filtered = options
    .filter(
      (option) =>
        showAll ||
        option.toLocaleLowerCase().includes(value.toLocaleLowerCase()),
    )
    .slice(0, 40);
  function choose(option: string) {
    onSelect(option);
    setOpen(false);
    setActive(-1);
  }
  return (
    <div
      className="vehicle-search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label htmlFor={id}>{tr(label)}</label>
      <div className="vehicle-search-input">
        <input
          id={id}
          name={name}
          value={value}
          maxLength={maxLength}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={id + "-options"}
          aria-activedescendant={
            open && active >= 0 ? id + "-" + active : undefined
          }
          onFocus={() => {
            setOpen(true);
            setShowAll(false);
          }}
          onChange={(event) => {
            onChange(event.target.value);
            setShowAll(false);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActive((index) =>
                Math.max(
                  0,
                  Math.min(
                    filtered.length - 1,
                    index + (event.key === "ArrowDown" ? 1 : -1),
                  ),
                ),
              );
            }
            if (
              event.key === "Enter" &&
              open &&
              active >= 0 &&
              filtered[active]
            ) {
              event.preventDefault();
              choose(filtered[active]);
            }
          }}
        />
        <button
          type="button"
          aria-label={tr("Показать варианты: {0}", [tr(label)])}
          aria-expanded={open}
          onClick={() => {
            setShowAll(true);
            setOpen((current) => !current);
            setActive(-1);
          }}
        >
          <ChevronDown size={18} />
        </button>
      </div>
      {open && (
        <div
          className="vehicle-search-options"
          id={id + "-options"}
          role="listbox"
          aria-label={tr(label)}
        >
          {filtered.map((option, index) => (
            <button
              key={option}
              id={id + "-" + index}
              type="button"
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
            >
              {option}
            </button>
          ))}
          {!filtered.length && (
            <p>{tr("Нет подходящего варианта. Оставьте свой ввод.")}</p>
          )}
        </div>
      )}
    </div>
  );
}
