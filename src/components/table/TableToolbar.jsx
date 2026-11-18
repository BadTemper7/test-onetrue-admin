import { Search, SlidersHorizontal } from "lucide-react";

// Presentation-only controls. Screens continue to own their search, filter and API state.
const join = (...parts) => parts.filter(Boolean).join(" ");

export function TableToolbar({ children, className = "", withTabs = false, ...props }) {
  return (
    <div
      className={join("otli-table-toolbar", withTabs && "otli-table-toolbar--tabs", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function TableSearchField({
  value = "",
  onChange,
  placeholder = "Search records...",
  ariaLabel = "Search records",
  onKeyDown,
  disabled = false,
  type = "search",
  className = "",
  ...inputProps
}) {
  return (
    <label className={join("otli-table-toolbar-search", className)}>
      <Search size={18} aria-hidden="true" />
      <input
        type={type}
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        disabled={disabled}
        {...inputProps}
      />
    </label>
  );
}

export function TableFilterButton({
  open,
  onClick,
  count = 0,
  label = "Filters",
  ariaLabel,
  disabled = false,
  className = "",
  ...props
}) {
  const activeCount = Math.max(0, Number(count) || 0);
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={Boolean(open)}
      aria-label={ariaLabel || label}
      onClick={onClick}
      disabled={disabled}
      className={join("otli-table-toolbar-filter", className)}
      {...props}
    >
      <SlidersHorizontal size={18} aria-hidden="true" />
      <span className="otli-table-toolbar-filter-text">{label}</span>
      {activeCount > 0 && (
        <span className="otli-table-toolbar-count" aria-label={`${activeCount} active filters`}>
          {activeCount}
        </span>
      )}
    </button>
  );
}

export function TableStatusTabs({
  options = [],
  value,
  onChange,
  label = "Filter by status",
  className = "",
  counts,
}) {
  return (
    <div
      className={join("otli-table-toolbar-tabs", className)}
      role="group"
      aria-label={label}
    >
      {options.map((option) => {
        const item = Array.isArray(option)
          ? { value: option[0], label: option[1] }
          : option;
        const active = item.value === value;
        const count = item.count ?? counts?.[item.value];
        return (
          <button
            key={item.value}
            type="button"
            className="otli-table-toolbar-tab"
            aria-pressed={active}
            onClick={() => onChange(item.value)}
          >
            <span className="otli-table-toolbar-tab-label">{item.label}</span>
            {count !== undefined && count !== null && (
              <span className="otli-table-toolbar-tab-count">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function TableToolbarSelect({ value, onChange, children, label, className = "", ...props }) {
  return (
    <select
      className={join("otli-table-toolbar-select", className)}
      aria-label={label || "Filter records"}
      value={value}
      onChange={onChange}
      {...props}
    >
      {children}
    </select>
  );
}
