import { CheckCircle2, MapPin } from "lucide-react"

const positiveNumber = (value, fallback = 1) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const slotKey = (bay, row, tier) => `${bay}-${row}-${tier}`

const getRequiredSlotKeys = ({ bay, row, tier, containerSize, blockContainerSize }) => {
  const keys = [slotKey(bay, row, tier)]
  if (Number(containerSize) === 40 && Number(blockContainerSize) === 20) {
    keys.push(slotKey(bay + 1, row, tier))
  }
  return keys
}

export const getAvailableYardSlots = ({
  block,
  unavailableSlots = [],
  containerSize,
  ignoredUnavailableKeys = [],
}) => {
  if (!block) return []

  const bayCount = positiveNumber(block.bayCount || block.lineCount)
  const rowCount = positiveNumber(block.rowCount)
  const tierCount = positiveNumber(block.tierCount)
  const ignored = new Set(ignoredUnavailableKeys.map(String))
  const unavailable = new Set(
    unavailableSlots
      .map((slot) => String(slot?.key || ""))
      .filter((key) => key && !ignored.has(key)),
  )
  const requiresAdjacentBay = Number(containerSize) === 40 && Number(block.containerSize) === 20
  const available = []

  for (let tier = 1; tier <= tierCount; tier += 1) {
    for (let row = 1; row <= rowCount; row += 1) {
      for (let bay = 1; bay <= bayCount; bay += 1) {
        if (requiresAdjacentBay && bay + 1 > bayCount) continue

        const requiredKeys = getRequiredSlotKeys({
          bay,
          row,
          tier,
          containerSize,
          blockContainerSize: block.containerSize,
        })
        if (requiredKeys.some((key) => unavailable.has(key))) continue

        available.push({
          key: slotKey(bay, row, tier),
          bay,
          row,
          tier,
          requiredKeys,
          requiresAdjacentBay,
        })
      }
    }
  }

  return available
}

const AvailableSlotPicker = ({
  block,
  unavailableSlots = [],
  containerSize,
  selectedBay,
  selectedRow,
  selectedTier,
  onSelect,
  ignoredUnavailableKeys = [],
  loading = false,
  disabled = false,
  emptyMessage = "No available slot matches this container in the selected block.",
}) => {
  const availableSlots = getAvailableYardSlots({
    block,
    unavailableSlots,
    containerSize,
    ignoredUnavailableKeys,
  })

  if (!block) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
        Select a yard area or block first to view its available slots.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-600">
        Checking current slot availability...
      </div>
    )
  }

  if (disabled || availableSlots.length === 0) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
        {emptyMessage}
      </div>
    )
  }

  const selectedKey = selectedBay && selectedRow && selectedTier
    ? slotKey(Number(selectedBay), Number(selectedRow), Number(selectedTier))
    : ""

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
            <MapPin size={14} /> Available Slots
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Select one location below. Only currently available positions are shown.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
          {availableSlots.length} available
        </span>
      </div>

      <div className="mt-4 grid max-h-80 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {availableSlots.map((slot) => {
          const selected = selectedKey === slot.key
          return (
            <button
              key={slot.key}
              type="button"
              onClick={() => onSelect?.(slot)}
              className={`rounded-xl border px-3 py-3 text-left transition ${selected
                ? "border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm"
                : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/60"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-black">
                  {slot.requiresAdjacentBay ? `Bay ${slot.bay} + ${slot.bay + 1}` : `Bay ${slot.bay}`}
                </div>
                {selected && <CheckCircle2 size={17} className="shrink-0 text-emerald-600" />}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">Row {slot.row} • Tier {slot.tier}</div>
              {slot.requiresAdjacentBay && (
                <div className="mt-2 text-[11px] font-black uppercase tracking-wide text-emerald-700">Uses 2 adjacent TEU slots</div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default AvailableSlotPicker
