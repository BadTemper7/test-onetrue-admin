import {
  FiChevronsLeft,
  FiChevronLeft,
  FiChevronRight,
  FiChevronsRight,
} from "react-icons/fi";

const getPageNumbers = (page, totalPages) => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) pages.push("left-ellipsis");
  for (let value = start; value <= end; value += 1) pages.push(value);
  if (end < totalPages - 1) pages.push("right-ellipsis");
  pages.push(totalPages);
  return pages;
};

const Pagination = ({
  page,
  setPage,
  pageSize,
  setPageSize,
  totalItems,
  totalPages,
  startItem,
  endItem,
  pageSizeOptions = [10, 20, 50, 100],
}) => {
  const safeTotalPages = Math.max(Number(totalPages) || 1, 1);
  const safePage = Math.min(Math.max(Number(page) || 1, 1), safeTotalPages);
  const canGoBack = safePage > 1;
  const canGoForward = safePage < safeTotalPages;
  const pages = getPageNumbers(safePage, safeTotalPages);

  const buttonClass =
    "grid h-9 min-w-9 place-items-center rounded-md border border-slate-200 bg-white px-2 text-slate-500 transition hover:border-yard-green/50 hover:bg-emerald-50 hover:text-yard-green disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-500";

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 bg-yard-fog/70 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500">
        <span>
          Showing <strong className="text-yard-navy">{startItem}-{endItem}</strong> of{" "}
          <strong className="text-yard-navy">{totalItems}</strong> records
        </span>
        <label className="inline-flex items-center gap-2">
          <span>Rows</span>
          <select
            value={pageSize}
            onChange={(event) => setPageSize(event.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-semibold text-yard-navy outline-none transition focus:border-yard-green focus:ring-2 focus:ring-emerald-100"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5 lg:justify-end">
        <button type="button" className={buttonClass} onClick={() => setPage(1)} disabled={!canGoBack} aria-label="First page">
          <FiChevronsLeft />
        </button>
        <button type="button" className={buttonClass} onClick={() => setPage((current) => Math.max(1, Number(current) - 1))} disabled={!canGoBack} aria-label="Previous page">
          <FiChevronLeft />
        </button>
        {pages.map((value) => typeof value === "number" ? (
          <button
            key={value}
            type="button"
            onClick={() => setPage(value)}
            aria-label={`Page ${value}`}
            aria-current={value === safePage ? "page" : undefined}
            className={`${buttonClass} ${value === safePage ? "border-yard-green bg-emerald-50 font-black text-yard-green" : ""}`}
          >
            {value}
          </button>
        ) : <span key={value} className="px-1 text-slate-400">…</span>)}
        <button type="button" className={buttonClass} onClick={() => setPage((current) => Math.min(safeTotalPages, Number(current) + 1))} disabled={!canGoForward} aria-label="Next page">
          <FiChevronRight />
        </button>
        <button type="button" className={buttonClass} onClick={() => setPage(safeTotalPages)} disabled={!canGoForward} aria-label="Last page">
          <FiChevronsRight />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
