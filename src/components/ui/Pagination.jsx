import {
  FiChevronsLeft,
  FiChevronLeft,
  FiChevronRight,
  FiChevronsRight,
} from "react-icons/fi";

const Pagination = ({
  page,
  setPage,
  pageSize,
  setPageSize,
  totalItems,
  totalPages,
  startItem,
  endItem,
  pageSizeOptions = [5, 10, 20, 50],
}) => {
  const canGoBack = page > 1;
  const canGoForward = page < totalPages;

  const buttonClass =
    "grid h-9 w-9 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-yard-green/50 hover:bg-emerald-50 hover:text-yard-green disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-500";

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 bg-yard-fog/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500">
        <span>
          Showing <strong className="text-yard-navy">{startItem}-{endItem}</strong> of{" "}
          <strong className="text-yard-navy">{totalItems}</strong>
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

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <button type="button" className={buttonClass} onClick={() => setPage(1)} disabled={!canGoBack} aria-label="First page">
          <FiChevronsLeft />
        </button>
        <button type="button" className={buttonClass} onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={!canGoBack} aria-label="Previous page">
          <FiChevronLeft />
        </button>
        <span className="min-w-[92px] text-center text-xs font-semibold text-slate-600">
          Page <span className="text-yard-green">{page}</span> of {totalPages}
        </span>
        <button type="button" className={buttonClass} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={!canGoForward} aria-label="Next page">
          <FiChevronRight />
        </button>
        <button type="button" className={buttonClass} onClick={() => setPage(totalPages)} disabled={!canGoForward} aria-label="Last page">
          <FiChevronsRight />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
