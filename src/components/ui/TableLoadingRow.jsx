const DEFAULT_ROWS = 5

const widthPatterns = [
  ["68%", "42%", "58%", "76%", "48%", "64%", "38%", "54%", "44%", "62%", "50%", "40%"],
  ["52%", "66%", "46%", "62%", "72%", "45%", "58%", "40%", "68%", "48%", "60%", "52%"],
  ["74%", "48%", "64%", "44%", "56%", "70%", "46%", "62%", "52%", "38%", "66%", "48%"],
  ["58%", "72%", "40%", "68%", "50%", "60%", "74%", "44%", "56%", "64%", "42%", "70%"],
  ["64%", "44%", "72%", "52%", "66%", "38%", "60%", "48%", "70%", "54%", "46%", "62%"],
]

const normalizeCount = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

const SkeletonBar = ({ width, className = "" }) => (
  <span
    className={`otli-table-skeleton block h-3.5 max-w-full rounded-md ${className}`.trim()}
    style={{ width }}
  />
)

const TableLoadingRow = ({
  colSpan,
  rows = DEFAULT_ROWS,
  actionColumn = false,
  label = "Loading table data",
  description = "Please wait while the latest records are being retrieved.",
  className = "",
}) => {
  const columnCount = normalizeCount(colSpan, 1)
  const rowCount = normalizeCount(rows, DEFAULT_ROWS)

  return (
    <>
      {Array.from({ length: rowCount }, (_, rowIndex) => (
        <tr
          key={`table-skeleton-${rowIndex}`}
          className={`border-b border-slate-100 last:border-b-0 ${className}`.trim()}
          aria-hidden="true"
        >
          {Array.from({ length: columnCount }, (_, columnIndex) => {
            const pattern = widthPatterns[rowIndex % widthPatterns.length]
            const width = pattern[columnIndex % pattern.length]
            const isActionColumn = actionColumn && columnIndex === columnCount - 1

            return (
              <td key={`table-skeleton-${rowIndex}-${columnIndex}`} className="px-5 py-4 align-middle">
                {isActionColumn ? (
                  <div className="flex items-center justify-end gap-2">
                    <span className="otli-table-skeleton h-9 w-9 rounded-lg" />
                    <span className="otli-table-skeleton hidden h-9 w-9 rounded-lg sm:block" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <SkeletonBar width={width} />
                    {columnIndex === 0 && rowIndex % 2 === 0 && (
                      <SkeletonBar width="40%" className="h-2.5 opacity-70" />
                    )}
                  </div>
                )}
              </td>
            )
          })}
        </tr>
      ))}

      <tr className="h-0 border-0 p-0">
        <td colSpan={columnCount} className="h-0 border-0 p-0">
          <span className="sr-only" role="status" aria-live="polite">
            {label}{description ? `. ${description}` : ""}
          </span>
        </td>
      </tr>
    </>
  )
}

export default TableLoadingRow
