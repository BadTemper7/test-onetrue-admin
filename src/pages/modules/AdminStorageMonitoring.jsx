import { TableToolbar, TableSearchField, TableFilterButton } from "../../components/table/TableToolbar";
import OperationalRecordCard, { RecordCardField } from "../../components/table/OperationalRecordCard"
import FilterDropdownPortal from "../../components/table/FilterDropdownPortal"
import { useEffect, useMemo, useRef, useState } from "react"
import { Boxes, CalendarClock, Layers3, RefreshCw, Rotate3D, Warehouse  } from "lucide-react"
import Alert from "../../components/Alert"
import ModalCloseButton from "../../components/ui/ModalCloseButton"
import { api, getApiError } from "../../lib/api"
import { fetchStorageAreaSummary, fetchStoragePage, fetchStorageSlotMap, fetchStorageBlockList } from "../../lib/storageMonitoring"
import TableCrudActions from "../../components/table/TableCrudActions"
import ContainerClassificationBadges from "../../components/ui/ContainerClassificationBadges"
import ContainerClassificationFilters from "../../components/ui/ContainerClassificationFilters"
import TableLoadingRow from "../../components/table/TableLoadingRow"
import Pagination from "../../components/table/Pagination"

const MAP_WIDTH = 980
const MAP_HEIGHT = 600

const statusLabels = {
  in_yard: "In Yard",
  hold: "Hold",
  gate_in_approved: "Gate-In Approved",
  stored_in_assigned_area: "Stored in Assigned Area",
  gate_out_requested: "Gate-Out Requested",
  gate_out_approved: "Gate-Out Approved",
  gate_out_reversal_requested: "Gate-Out Reversal Requested",
  completed_gate_out_done: "Completed / Gate-Out Done",
}

const statusClass = (status) => {
  if (["in_yard", "stored_in_assigned_area"].includes(status)) return "bg-blue-50 text-blue-700"
  if (["gate_out_requested", "gate_out_approved", "gate_out_reversal_requested"].includes(status)) return "bg-blue-50 text-blue-700"
  if (status === "hold") return "bg-red-50 text-red-700"
  return "bg-slate-100 text-slate-700"
}

const numberValue = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const formatDate = (value) => {
  if (!value) return "-"
  return new Date(value).toLocaleString()
}

const daysInYard = (value) => {
  if (!value) return 0
  const diff = Date.now() - new Date(value).getTime()
  return Math.max(Math.floor(diff / (1000 * 60 * 60 * 24)), 0)
}

const getCapacityUnit = (yardContainerSize) => Number(yardContainerSize) === 20 ? "TEU" : "FEU"
const asYardUnits = (teu, yardContainerSize) => Number(yardContainerSize) === 40 ? numberValue(teu) / 2 : numberValue(teu)
const roundCapacity = (value) => Math.round(numberValue(value) * 100) / 100

const getBlockBounds = (block) => {
  const width = Math.max(numberValue(block.width, 210), 90)
  const height = Math.max(numberValue(block.height, 120), 70)
  const x = clamp(numberValue(block.x, 0), 0, MAP_WIDTH - width)
  const y = clamp(numberValue(block.y, 0), 0, MAP_HEIGHT - height)
  return { x, y, width, height }
}

const getSlotCounts = (block = {}, area = {}) => {
  const bayValue = block?.bayCount ?? block?.lineCount ?? area?.bayCount ?? area?.lineCount ?? 1
  const rowValue = block?.rowCount ?? area?.rowCount ?? 1
  const tierValue = block?.tierCount ?? area?.tierCount ?? 1

  return {
    bayCount: Math.max(numberValue(bayValue, 1), 1),
    rowCount: Math.max(numberValue(rowValue, 1), 1),
    tierCount: Math.max(numberValue(tierValue, 1), 1),
  }
}

const getViewerBlockBounds = (block, selectedBlockId, area) => {
  if (!selectedBlockId) return getBlockBounds(block)

  const { bayCount, rowCount } = getSlotCounts(block, area)
  const width = clamp(rowCount * 92 + 118, 460, 900)
  const height = clamp(bayCount * 62 + 118, 420, 760)

  return {
    x: 0,
    y: 0,
    width,
    height,
  }
}

const getContainerBoxPosition = (container, block, area = {}, boundsOverride = null) => {
  const { bayCount, rowCount, tierCount } = getSlotCounts(block, area)
  const bay = clamp(numberValue(container.bay, 1), 1, bayCount)
  const row = clamp(numberValue(container.row, 1), 1, rowCount)
  const tier = clamp(numberValue(container.tier, 1), 1, tierCount)
  const bounds = boundsOverride || getBlockBounds(block)
  const leftPadding = 58
  const topPadding = 54
  const rightPadding = 26
  const bottomPadding = 44
  const usableWidth = Math.max(bounds.width - leftPadding - rightPadding, 80)
  const usableHeight = Math.max(bounds.height - topPadding - bottomPadding, 80)
  const cellWidth = Math.max(usableWidth / rowCount, 20)
  const cellHeight = Math.max(usableHeight / bayCount, 20)
  const boxWidth = clamp(cellWidth * 0.72, 22, 76)
  const boxHeight = clamp(cellHeight * 0.64, 18, 48)
  const stackStep = 26

  return {
    left: leftPadding + (row - 1) * cellWidth + (cellWidth - boxWidth) / 2,
    top: topPadding + (bay - 1) * cellHeight + (cellHeight - boxHeight) / 2,
    width: boxWidth,
    height: boxHeight,
    depth: clamp(cellHeight * 0.24, 8, 16),
    z: 24 + (tier - 1) * stackStep,
    stackStep,
    bay,
    row,
    tier,
    bayCount,
    rowCount,
    tierCount,
    label: `Bay ${bay} / Row ${row} / Tier ${tier}`,
  }
}

const Field = ({ label, children }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>
    {children}
  </label>
)

const statToneClasses = {
  slate: "border-slate-200 bg-slate-50 text-slate-950",
  blue: "border-blue-100 bg-blue-50 text-blue-700",
  emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
}

const StatCard = ({ label, value, icon: Icon, tone = "slate" }) => (
  <div className={`rounded-2xl border p-5 ${statToneClasses[tone]}`}>
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-xs font-black uppercase tracking-wide opacity-75">{label}</div>
        <div className="mt-2 text-3xl font-black">{value}</div>
      </div>
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/90 shadow-sm">
        <Icon size={20} />
      </div>
    </div>
  </div>
)

const AreaList = ({ areas, selectedAreaId, onSelectArea, occupancyByArea, loading }) => {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2">
        <Warehouse size={18} className="text-emerald-700" />
        <h2 className="text-lg font-black text-slate-950">Yard Areas</h2>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">All {areas.length} yard areas are displayed. Click any area to load its blocks and full 3D layout.</p>
        {selectedAreaId && <button type="button" className="text-sm font-bold text-emerald-700 hover:underline" onClick={() => onSelectArea("")}>Show all areas</button>}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {areas.length === 0 && <div className="rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">{loading ? "Loading yard areas..." : "No yard areas found."}</div>}
        {areas.map((area) => {
          const areaStats = occupancyByArea[area.id] || {}
          const total = numberValue(area.totalTeuSlots || area.capacityTeu)
          const used = asYardUnits(areaStats.usedTeu, area.containerSize)
          const usage = total ? clamp(Math.round((used / total) * 100), 0, 100) : 0
          const active = selectedAreaId === area.id

          return (
            <button
              key={area.id}
              type="button"
              onClick={() => onSelectArea(active ? "" : area.id)}
              aria-pressed={active}
              className={`rounded-3xl border p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${active ? "border-emerald-400 bg-emerald-50 ring-4 ring-emerald-100" : "border-slate-200 bg-white"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xl font-black text-slate-950">{area.name}</div>
                  <div className="mt-1 text-xs font-black uppercase tracking-wide text-slate-400">{area.code || "Yard"} • {area.containerSize}ft • {getSlotCounts({}, area).bayCount} Bay / {getSlotCounts({}, area).rowCount} Row / {getSlotCounts({}, area).tierCount} Tier</div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">{area.blockCount || 0} blocks • {area.status || "active"}</div>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-emerald-700 shadow-sm">{areaStats.containerCount || 0} CNTR</span>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs font-black text-slate-500">
                <span>{roundCapacity(used)} / {total} {getCapacityUnit(area.containerSize)}</span>
                <span>{usage}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-600" style={{ width: `${usage}%` }} />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const BlockList = ({ selectedArea, blocks, selectedBlockId, onSelectBlock, occupancyByBlock, unmatchedCount, loadingBlocks }) => {

  if (!selectedArea) {
    return (
      <div className="card p-8 text-center">
        <Layers3 className="mx-auto text-slate-300" size={42} />
        <div className="mt-3 text-xl font-black text-slate-800">Select an area first</div>
        <div className="mt-1 text-sm font-semibold text-slate-500">Blocks will appear after selecting a yard area.</div>
      </div>
    )
  }

  return (
    <div className="card p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Boxes size={18} className="text-emerald-700" />
            <h2 className="text-lg font-black text-slate-950">{selectedArea.name} Blocks</h2>
          </div>
          <p className="mt-1 text-sm font-medium text-slate-500">Select a block to filter stored containers. Open the 3D yard view below to inspect its slots.</p>
        </div>
        <button type="button" onClick={() => onSelectBlock("")} className={`rounded-2xl px-4 py-2 text-sm font-black ${!selectedBlockId ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
          View all blocks
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {blocks.length === 0 && <div className="rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">{loadingBlocks ? "Loading blocks for this area..." : "No blocks configured for this area."}</div>}
        {blocks.map((block) => {
          const blockStats = occupancyByBlock[block.id] || {}
          const total = numberValue(block.teuSlots ?? block.capacityTeu)
          const used = asYardUnits(blockStats.usedTeu, block.containerSize || selectedArea?.containerSize)
          const usage = total ? clamp(Math.round((used / total) * 100), 0, 100) : 0
          const active = selectedBlockId === block.id

          return (
            <button
              key={block.id}
              type="button"
              onClick={() => onSelectBlock(block.id)}
              className={`rounded-3xl border p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${active ? "border-emerald-400 bg-emerald-50 ring-4 ring-emerald-100" : "border-slate-200 bg-white"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-black text-slate-950">{block.code}</div>
                  <div className="text-xs font-bold text-slate-500">{block.name}</div>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-emerald-700 shadow-sm">{blockStats.containerCount || 0} CNTR</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-black text-slate-600">
                <div className="rounded-xl bg-slate-50 p-2">{getSlotCounts(block, selectedArea).bayCount}<br /><span className="text-[10px] uppercase text-slate-400">Bay</span></div>
                <div className="rounded-xl bg-slate-50 p-2">{getSlotCounts(block, selectedArea).rowCount}<br /><span className="text-[10px] uppercase text-slate-400">Row</span></div>
                <div className="rounded-xl bg-slate-50 p-2">{getSlotCounts(block, selectedArea).tierCount}<br /><span className="text-[10px] uppercase text-slate-400">Tier</span></div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs font-black text-slate-500">
                <span>{roundCapacity(used)} / {total} {getCapacityUnit(block.containerSize || selectedArea?.containerSize)}</span>
                <span>{usage}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-600" style={{ width: `${usage}%` }} />
              </div>
            </button>
          )
        })}
      </div>
      {unmatchedCount > 0 && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          {unmatchedCount} stored container{unmatchedCount === 1 ? " has" : "s have"} no matching block in this area. Review the yard location in Inventory.
        </p>
      )}
    </div>
  )
}

const SlotSummaryCard = ({ label, value, sublabel, icon: Icon }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center gap-4">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700">
        <Icon size={22} />
      </div>
      <div>
        <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</div>
        <div className="text-2xl font-black leading-tight text-slate-950">{value}</div>
        {sublabel && <div className="text-xs font-semibold text-slate-500">{sublabel}</div>}
      </div>
    </div>
  </div>
)

const SlotLegend = () => (
  <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-600">
    <span className="inline-flex items-center gap-2"><span className="h-4 w-4 border border-slate-400 bg-white/[0.07]0" /> Empty</span>
    <span className="inline-flex items-center gap-2"><span className="h-4 w-4 border border-blue-800 bg-blue-700" /> Assigned</span>
    <span className="inline-flex items-center gap-2"><span className="h-4 w-4 border border-amber-400 bg-amber-50" /> Selected</span>
  </div>
)

const getContainerSlotKey = (container) => {
  const bay = numberValue(container.bay, 1)
  const row = numberValue(container.row, 1)
  const tier = numberValue(container.tier, 1)
  return `${bay}-${row}-${tier}`
}

const Cube3D = ({ cube, assignedContainer, selected, onSelect }) => {
  const filled = Boolean(assignedContainer)
  const className = [
    "yard-cube",
    filled ? "yard-cube-assigned" : "yard-cube-empty",
    selected ? "yard-cube-selected" : "",
  ].filter(Boolean).join(" ")

  return (
    <button
      type="button"
      className={className}
      onClick={filled ? onSelect : undefined}
      aria-label={filled ? `${assignedContainer.containerNumber} at Bay ${cube.bay}, Row ${cube.row}, Tier ${cube.tier}` : `Empty slot Bay ${cube.bay}, Row ${cube.row}, Tier ${cube.tier}`}
      style={{
        width: cube.width,
        height: cube.height,
        transform: `translate3d(${cube.x}px, ${cube.y}px, ${cube.z}px)`,
        cursor: filled ? "pointer" : "default",
      }}
    >
      <span className="yard-cube-face yard-cube-front" />
      <span className="yard-cube-face yard-cube-back" />
      <span className="yard-cube-face yard-cube-right" />
      <span className="yard-cube-face yard-cube-left" />
      <span className="yard-cube-face yard-cube-top" />
      <span className="yard-cube-face yard-cube-bottom" />
      {filled && <span className="yard-cube-label">{String(assignedContainer.containerNumber || "CNTR").slice(0, 7)}</span>}
    </button>
  )
}

const AxisLabel = ({ children, style, className = "" }) => (
  <span className={`yard-axis-label ${className}`} style={style}>{children}</span>
)

const BlockSlotMap = ({ selectedArea, block, containers }) => {
  const { bayCount, rowCount, tierCount } = getSlotCounts(block, selectedArea)
  const [selectedContainerId, setSelectedContainerId] = useState("")
  const [rotation, setRotation] = useState(-38)
  const [tilt, setTilt] = useState(58)
  const [zoom, setZoom] = useState(1)
  const dragRef = useRef(null)

  const containersBySlot = useMemo(() => {
    return containers.reduce((acc, container) => {
      acc[getContainerSlotKey(container)] = container
      return acc
    }, {})
  }, [containers])

  useEffect(() => {
    if (containers.length === 0) {
      setSelectedContainerId("")
      return
    }

    if (!containers.some((container) => container.id === selectedContainerId)) {
      setSelectedContainerId(containers[0].id)
    }
  }, [containers, selectedContainerId])

  const selectedContainer = containers.find((container) => container.id === selectedContainerId) || containers[0] || null
  const selectedSlotKey = selectedContainer ? getContainerSlotKey(selectedContainer) : ""

  const cubeW = 58
  const cubeH = 42
  const cubeD = 52
  const gap = 1.5
  const sceneWidth = rowCount * (cubeW + gap)
  const sceneDepth = tierCount * (cubeD + gap)
  const sceneHeight = bayCount * (cubeH + gap)
  const viewportHeight = clamp(420 + bayCount * 24 + tierCount * 12, 540, 760)

  const cubes = []
  for (let bay = 1; bay <= bayCount; bay += 1) {
    for (let tier = tierCount; tier >= 1; tier -= 1) {
      for (let row = 1; row <= rowCount; row += 1) {
        const key = `${bay}-${row}-${tier}`
        cubes.push({
          key,
          row,
          bay,
          tier,
          x: (row - 1) * (cubeW + gap),
          y: -(bay - 1) * (cubeH + gap),
          z: (tier - 1) * (cubeD + gap),
          width: cubeW,
          height: cubeH,
          depth: cubeD,
          assignedContainer: containersBySlot[key],
        })
      }
    }
  }

  const handlePointerDown = (event) => {
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startRotation: rotation,
      startTilt: tilt,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event) => {
    if (!dragRef.current) return

    const deltaX = event.clientX - dragRef.current.startX
    const deltaY = event.clientY - dragRef.current.startY

    setRotation(dragRef.current.startRotation + deltaX * 0.25)
    setTilt(clamp(dragRef.current.startTilt - deltaY * 0.18, 28, 78))
  }

  const handlePointerEnd = () => {
    dragRef.current = null
  }

  const resetView = () => {
    setRotation(-38)
    setTilt(58)
    setZoom(1)
  }

  const selectedCoordinateLabel = selectedContainer
    ? `${selectedArea?.name || "Area"} - Bay ${numberValue(selectedContainer.bay, 1)}, Row ${numberValue(selectedContainer.row, 1)}, Tier ${numberValue(selectedContainer.tier, 1)}`
    : "No assigned container selected"

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 p-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h3 className="text-lg font-black uppercase tracking-wide text-slate-950">{block.code || block.name} Block - 3D Slot Map</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Bays: {bayCount} • Rows: {rowCount} • Tiers: {tierCount}
          </p>
          <p className="mt-1 text-xs font-bold text-slate-400">This is a true CSS 3D stack. Drag left/right to rotate the whole block. Drag up/down to change the camera angle.</p>
        </div>
        <div className="flex flex-col gap-3 xl:items-end">
          <SlotLegend />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50" onClick={() => setRotation((value) => value - 18)}>
              Rotate Left
            </button>
            <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50" onClick={() => setRotation((value) => value + 18)}>
              Rotate Right
            </button>
            <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50" onClick={() => setTilt((value) => clamp(value + 6, 28, 78))}>
              Tilt Up
            </button>
            <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50" onClick={() => setTilt((value) => clamp(value - 6, 28, 78))}>
              Tilt Down
            </button>
            <button type="button" className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-slate-800" onClick={resetView}>
              Reset View
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white p-5">
        <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-3">
          <label className="text-xs font-black uppercase tracking-wide text-slate-500">
            Rotate: {Math.round(rotation)}°
            <input className="mt-2 w-full accent-blue-700" type="range" min="-180" max="180" value={rotation} onChange={(event) => setRotation(Number(event.target.value))} />
          </label>
          <label className="text-xs font-black uppercase tracking-wide text-slate-500">
            Tilt: {Math.round(tilt)}°
            <input className="mt-2 w-full accent-blue-700" type="range" min="28" max="78" value={tilt} onChange={(event) => setTilt(Number(event.target.value))} />
          </label>
          <label className="text-xs font-black uppercase tracking-wide text-slate-500">
            Zoom: {Math.round(zoom * 100)}%
            <input className="mt-2 w-full accent-blue-700" type="range" min="0.65" max="1.35" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
          </label>
        </div>

        <div
          className="yard-3d-viewport"
          style={{ height: viewportHeight }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          <div className="yard-3d-helper yard-3d-helper-bay">TIER (VERTICAL)</div>
          <div className="yard-3d-helper yard-3d-helper-row">ROW (HORIZONTAL)</div>
          <div className="yard-3d-helper yard-3d-helper-tier">BAY (FRONT TO BACK)</div>

          <div
            className="yard-3d-scene"
            style={{
              width: sceneWidth,
              height: sceneHeight,
              transform: `translate(-50%, -50%) scale(${zoom}) rotateX(${tilt}deg) rotateZ(${rotation}deg)`,
            }}
          >
            <div
              className="yard-floor-plane"
              style={{
                width: sceneWidth,
                height: sceneDepth,
                transform: `rotateX(90deg) translateZ(${cubeH * 0.5}px)`,
                backgroundSize: `${cubeW + gap}px ${cubeD + gap}px`,
              }}
            />

            {Array.from({ length: rowCount }, (_, index) => {
              const row = index + 1
              return (
                <AxisLabel
                  key={`row-label-${row}`}
                  className="yard-axis-row"
                  style={{ transform: `translate3d(${(row - 0.5) * (cubeW + gap) - 4}px, ${cubeH + 18}px, -34px) rotateZ(${-rotation}deg) rotateX(${-tilt}deg)` }}
                >
                  {row}
                </AxisLabel>
              )
            })}

            {Array.from({ length: tierCount }, (_, index) => {
              const tierNumber = index + 1
              return (
                <AxisLabel
                  key={`tier-label-${tierNumber}`}
                  className="yard-axis-tier"
                  style={{ transform: `translate3d(-38px, ${cubeH + 4}px, ${(tierNumber - 0.5) * (cubeD + gap)}px) rotateZ(${-rotation}deg) rotateX(${-tilt}deg)` }}
                >
                  {tierNumber}
                </AxisLabel>
              )
            })}

            {Array.from({ length: bayCount }, (_, index) => {
              const bayNumber = index + 1
              return (
                <AxisLabel
                  key={`bay-label-${bayNumber}`}
                  className="yard-axis-bay"
                  style={{ transform: `translate3d(${sceneWidth + 18}px, ${-(bayNumber - 1) * (cubeH + gap) + 8}px, -24px) rotateZ(${-rotation}deg) rotateX(${-tilt}deg)` }}
                >
                  {bayNumber}
                </AxisLabel>
              )
            })}

            {cubes.map((cube) => {
              const selected = cube.key === selectedSlotKey
              return (
                <Cube3D
                  key={cube.key}
                  cube={cube}
                  assignedContainer={cube.assignedContainer}
                  selected={selected}
                  onSelect={() => setSelectedContainerId(cube.assignedContainer.id)}
                />
              )
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 p-5">
        {selectedContainer ? (
          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1fr]">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-blue-700 text-white"><Warehouse size={21} /></div>
              <div>
                <div className="text-xs font-black uppercase tracking-wide text-slate-500">Selected Coordinate</div>
                <div className="text-base font-black text-slate-950">{selectedCoordinateLabel}</div>
              </div>
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-wide text-slate-500">Container ID</div>
              <div className="mt-1 font-black text-slate-950">{selectedContainer.containerNumber}</div>
              <ContainerClassificationBadges loadStatus={selectedContainer.containerLoadStatus || selectedContainer.containerStatus} rateType={selectedContainer.rateType} className="mt-2" compact />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-wide text-slate-500">Status</div>
              <div className="mt-1 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-black uppercase text-blue-700">Assigned</div>
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-wide text-slate-500">Stored At</div>
              <div className="mt-1 text-sm font-bold text-slate-700">{formatDate(selectedContainer.storageStartDate || selectedContainer.storedAt || selectedContainer.updatedAt)}</div>
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-wide text-slate-500">Customer</div>
              <div className="mt-1 text-sm font-bold text-slate-700">{selectedContainer.clientName || "-"}</div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">
            No assigned container in this block yet.
          </div>
        )}
      </div>
    </div>
  )
}

const Storage3DViewer = ({ selectedArea, selectedBlockId, blocks, containers, loadingBlocks }) => {
  const containersByBlock = useMemo(() => {
    const mapped = new Map()
    for (const item of containers) {
      if (!mapped.has(item.block)) mapped.set(item.block, [])
      mapped.get(item.block).push(item)
    }
    return mapped
  }, [containers])
  if (!selectedArea || loadingBlocks) return null
  const visibleBlocks = selectedBlockId ? blocks.filter((block) => block.id === selectedBlockId) : blocks

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-950"><Rotate3D size={20} className="text-emerald-700" /> {selectedArea.name} - 3D Yard View</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{selectedBlockId ? "Focused block" : "All blocks"} • Click a blue slot to inspect its container.</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">{containers.length} stored containers</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <SlotSummaryCard label="Area" value={selectedArea.code || selectedArea.name} icon={Warehouse} />
          <SlotSummaryCard label="Blocks" value={visibleBlocks.length} icon={Boxes} />
          <SlotSummaryCard label="Containers" value={containers.length} icon={Layers3} />
          <SlotSummaryCard label="Capacity" value={numberValue(selectedArea.totalTeuSlots || selectedArea.capacityTeu)} sublabel={getCapacityUnit(selectedArea.containerSize)} icon={Layers3} />
        </div>
      </div>
      <div className="space-y-5 p-5">
        {visibleBlocks.length === 0 ? (
          <div className="grid min-h-[200px] place-items-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
            <div>
              <Boxes className="mx-auto text-slate-300" size={42} />
              <h3 className="mt-3 text-lg font-black text-slate-800">No blocks configured</h3>
              <p className="mt-1 text-sm font-medium text-slate-500">Add blocks under Yard Area setup to display 3D locations.</p>
            </div>
          </div>
        ) : visibleBlocks.map((block) => (
          <BlockSlotMap
            key={`${selectedArea.id}:${block.id}`}
            selectedArea={selectedArea}
            block={block}
            containers={containersByBlock.get(block.id) || []}
          />
        ))}
      </div>
    </section>
  )
}

const AdminStorageMonitoring = () => {
  const [areas, setAreas] = useState([])
  const [containers, setContainers] = useState([])
  const [visualContainers, setVisualContainers] = useState([])
  const [showVisualization, setShowVisualization] = useState(false)
  const [visualAreaId, setVisualAreaId] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [paginationMeta, setPaginationMeta] = useState({ total: 0, totalPages: 1 })
  const [tableLoading, setTableLoading] = useState(true)
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [overviewVersion, setOverviewVersion] = useState(0)
  const [tableVersion, setTableVersion] = useState(0)
  const [storageOccupancy, setStorageOccupancy] = useState({
    areas: [], blocks: [], totalContainers: 0, totalTeu: 0,
    assignedContainers: 0, assignedTeu: 0, unassignedContainers: 0,
  })
  const [selectedAreaId, setSelectedAreaId] = useState("")
  const [selectedBlockId, setSelectedBlockId] = useState("")
  const [blocks, setBlocks] = useState([])
  const [blocksAreaId, setBlocksAreaId] = useState("")
  const [blockRefreshVersion, setBlockRefreshVersion] = useState(0)
  const [selectedStorageContainer, setSelectedStorageContainer] = useState(null)
  const [selectedLoadStatus, setSelectedLoadStatus] = useState("all")
  const [selectedRateType, setSelectedRateType] = useState("all")
  const [search, setSearch] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [loading, setLoading] = useState(true)
  const [alert, setAlert] = useState({ type: "", message: "" })
  const filterRef = useRef(null)

  const realtimeTimerRef = useRef(null)
  const realtimeFlagsRef = useRef({ yard: false, inventory: false })
  const selectedAreaRef = useRef(selectedAreaId)
  selectedAreaRef.current = selectedAreaId


  const selectedArea = useMemo(() => areas.find((area) => area.id === selectedAreaId) || null, [areas, selectedAreaId])
  const occupancyByArea = useMemo(() => Object.fromEntries(
    (storageOccupancy.areas || []).map((item) => [item.areaId, item]),
  ), [storageOccupancy.areas])
  const occupancyByBlock = useMemo(() => Object.fromEntries(
    (storageOccupancy.blocks || []).map((item) => [item.blockId, item]),
  ), [storageOccupancy.blocks])
  const selectedAreaStats = occupancyByArea[selectedAreaId] || {}
  const loadingBlocks = Boolean(selectedAreaId) && blocksAreaId !== selectedAreaId
  const unmatchedBlockCount = selectedAreaId && !loadingBlocks
    ? Math.max(numberValue(selectedAreaStats.containerCount) - (storageOccupancy.blocks || [])
      .filter((item) => item.areaId === selectedAreaId && blocks.some((block) => block.id === item.blockId))
      .reduce((total, item) => total + numberValue(item.containerCount), 0), 0)
    : 0

  // The server applies table filters across every matching record; only this page is in memory.
  // The 3D viewer has its own complete selected-area dataset and is never driven by a table page.
  const tableContainers = containers
  const selectedAreaContainers = visualContainers
  const matchingTotal = paginationMeta.total
  const tablePagination = {
    page, setPage, pageSize,
    setPageSize: (value) => { setPageSize(Number(value) || 25); setPage(1) },
    totalItems: matchingTotal,
    totalPages: paginationMeta.totalPages,
    startItem: matchingTotal ? (page - 1) * pageSize + 1 : 0,
    endItem: Math.min(page * pageSize, matchingTotal),
    pageSizeOptions: [10, 25, 50, 100],
  }

  const knownAreaIds = useMemo(() => new Set(areas.map((area) => area.id)), [areas])
  const missingAreaCount = (storageOccupancy.areas || [])
    .filter((item) => !knownAreaIds.has(item.areaId))
    .reduce((total, item) => total + numberValue(item.containerCount), 0)
  const recognizedAreaTeu = (storageOccupancy.areas || [])
    .filter((item) => knownAreaIds.has(item.areaId))
    .reduce((total, item) => total + numberValue(item.usedTeu), 0)
  const usedCapacity = selectedArea
    ? { label: `Used ${getCapacityUnit(selectedArea.containerSize)}`, value: asYardUnits(selectedAreaStats.usedTeu, selectedArea.containerSize) }
    : { label: "Used TEU Equivalent", value: recognizedAreaTeu }

  const handleAreaChange = (areaId) => {
    setSelectedAreaId(areaId)
    setSelectedBlockId("")
    setShowVisualization(false)
    setVisualContainers([])
    setVisualAreaId("")
    setShowFilters(false)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => { setPage(1) }, [selectedAreaId, selectedBlockId, selectedLoadStatus, selectedRateType, debouncedSearch])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    fetchStorageAreaSummary(api, controller.signal)
      .then(({ areas: nextAreas, occupancy }) => {
        if (controller.signal.aborted) return
        setAreas(nextAreas)
        setStorageOccupancy(occupancy)
      })
      .catch((error) => {
        if (!controller.signal.aborted) setAlert({ type: "error", message: getApiError(error) })
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [overviewVersion])

  useEffect(() => {
    const controller = new AbortController()
    setTableLoading(true)
    fetchStoragePage(api, { page, limit: pageSize, areaId: selectedAreaId, blockId: selectedBlockId, loadStatus: selectedLoadStatus, rateType: selectedRateType, search: debouncedSearch }, controller.signal)
      .then(({ containers: nextRows, pagination }) => {
        if (controller.signal.aborted) return
        setContainers(nextRows)
        const effectivePage = Number(pagination.page) || page
        if (effectivePage !== page) setPage(effectivePage)
        setPaginationMeta({ total: Number(pagination.total) || 0, totalPages: Math.max(Number(pagination.totalPages) || 1, 1) })
      })
      .catch((error) => {
        if (!controller.signal.aborted) setAlert({ type: "error", message: getApiError(error) })
      })
      .finally(() => { if (!controller.signal.aborted) setTableLoading(false) })
    return () => controller.abort()
  }, [page, pageSize, selectedAreaId, selectedBlockId, selectedLoadStatus, selectedRateType, debouncedSearch, tableVersion])

  // Block metadata is small; selecting a yard must not trigger the full 3D dataset.
  useEffect(() => {
    setBlocks([])
    setBlocksAreaId("")
    if (!selectedAreaId) return undefined
    const controller = new AbortController()
    fetchStorageBlockList(api, selectedAreaId, controller.signal)
      .then((nextBlocks) => {
        if (controller.signal.aborted) return
        setBlocks(nextBlocks)
        setBlocksAreaId(selectedAreaId)
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setAlert({ type: "error", message: getApiError(error) })
          setBlocksAreaId(selectedAreaId)
        }
      })
    return () => controller.abort()
  }, [selectedAreaId, blockRefreshVersion])

  // Full slot geometry/containers are expensive. Load only after the admin asks
  // to open the 3D view. Keep all other storage workflows usable immediately.
  useEffect(() => {
    setVisualContainers([])
    setVisualAreaId("")
    if (!showVisualization || !selectedAreaId) return undefined
    const controller = new AbortController()
    fetchStorageSlotMap(api, selectedAreaId, controller.signal)
      .then(({ containers: nextContainers }) => {
        if (controller.signal.aborted) return
        setVisualContainers(nextContainers)
        setVisualAreaId(selectedAreaId)
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setAlert({ type: "error", message: getApiError(error) })
          setVisualAreaId(selectedAreaId)
        }
      })
    return () => controller.abort()
  }, [showVisualization, selectedAreaId, blockRefreshVersion])

  useEffect(() => {
    const handleRealtime = (event) => {
      const type = event.detail?.type || ""
      const yardChanged = type.startsWith("yard:") || type.startsWith("inventory:block_")
      const inventoryChanged = type.startsWith("booking:") || type.startsWith("storage:")
        || ["inventory:container_assigned", "inventory:container_created", "inventory:legacy_container_created", "inventory:updated"].includes(type)
      if (!yardChanged && !inventoryChanged) return
      realtimeFlagsRef.current = {
        yard: realtimeFlagsRef.current.yard || yardChanged,
        inventory: realtimeFlagsRef.current.inventory || inventoryChanged,
      }
      if (realtimeTimerRef.current) window.clearTimeout(realtimeTimerRef.current)
      realtimeTimerRef.current = window.setTimeout(() => {
        const flags = realtimeFlagsRef.current
        realtimeFlagsRef.current = { yard: false, inventory: false }
        realtimeTimerRef.current = null
        if (flags.inventory) setTableVersion((n) => n + 1)
        setOverviewVersion((n) => n + 1)
        if (selectedAreaRef.current) setBlockRefreshVersion((n) => n + 1)
      }, 700)
    }
    window.addEventListener("otli:realtime", handleRealtime)
    return () => {
      window.removeEventListener("otli:realtime", handleRealtime)
      if (realtimeTimerRef.current) window.clearTimeout(realtimeTimerRef.current)
    }
  }, [])

  const handleRefresh = () => {
    setOverviewVersion((n) => n + 1)
    setTableVersion((n) => n + 1)
    if (selectedAreaId) setBlockRefreshVersion((n) => n + 1)
  }

  return (
    <div className="space-y-6">
      <section className="card p-5 otli-module-frame">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between otli-module-hero">
          <div>
            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-emerald-700"><Warehouse size={15} /> Yard Module</div>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Storage Monitoring</h2>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-500">Browse stored containers with server-side search and pagination. Select an area to inspect its blocks, then open the optional 3D yard view when needed.</p>
          </div>
          <button type="button" onClick={handleRefresh} className="btn-secondary shrink-0" disabled={loading}><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh</button>
        </div>
        <div className="otli-kpi-grid mt-5 grid gap-4 md:grid-cols-3 otli-module-kpis otli-module-kpis--icons-leading">
          <StatCard label="Selected Area" value={selectedArea?.name || "All Areas"} icon={Warehouse} tone="slate" />
          <StatCard label={search.trim() || selectedAreaId || selectedBlockId || selectedLoadStatus !== "all" || selectedRateType !== "all" ? "Matching Containers" : "Stored Containers"} value={matchingTotal} icon={Boxes} tone="blue" />
          <StatCard label={usedCapacity.label} value={roundCapacity(usedCapacity.value)} icon={CalendarClock} tone="emerald" />
        </div>
        <div className="mt-4"><Alert type={alert.type}>{alert.message}</Alert></div>
        {storageOccupancy.unassignedContainers > 0 && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            {storageOccupancy.unassignedContainers} stored container{storageOccupancy.unassignedContainers === 1 ? " is" : "s are"} not assigned to a yard area. These are excluded from area occupancy totals.
          </p>
        )}
        {missingAreaCount > 0 && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            {missingAreaCount} stored container{missingAreaCount === 1 ? " references" : "s reference"} a yard area that no longer exists in Yard Area Setup. Review the container assignments in Inventory.
          </p>
        )}
      </section>

      <AreaList areas={areas} selectedAreaId={selectedAreaId} onSelectArea={handleAreaChange} occupancyByArea={occupancyByArea} loading={loading} />
      {selectedArea && (
        <>
          <BlockList selectedArea={selectedArea} blocks={blocks} selectedBlockId={selectedBlockId} onSelectBlock={setSelectedBlockId} occupancyByBlock={occupancyByBlock} unmatchedCount={unmatchedBlockCount} loadingBlocks={loadingBlocks} />
          <div className="card flex flex-wrap items-center justify-between gap-4 p-4">
            <div>
              <p className="text-sm font-black text-slate-900">3D Yard Visualization</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Loads the complete area slot map only when opened, keeping the storage table fast.</p>
            </div>
            <button type="button" className="btn-secondary" onClick={() => setShowVisualization((current) => !current)} disabled={loadingBlocks}>
              <Rotate3D size={17} /> {showVisualization ? "Hide 3D Yard View" : "Open 3D Yard View"}
            </button>
          </div>
          {showVisualization && (visualAreaId !== selectedAreaId
            ? <div className="card p-8 text-center text-sm font-semibold text-slate-500">Loading 3D yard visualization for {selectedArea.name}...</div>
            : <Storage3DViewer selectedArea={selectedArea} selectedBlockId={selectedBlockId} blocks={blocks} containers={selectedAreaContainers} loadingBlocks={loadingBlocks} />)}
        </>
      )}

      <section className="card overflow-visible">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-950">Stored Container List</h3>
            <p className="text-sm font-semibold text-slate-500">Search and filter every stored container. Pages load only the matching records; occupancy totals remain unchanged.</p>
          </div>
          <TableToolbar>
            <TableSearchField placeholder="Search container, booking, customer..." value={search} onChange={(event) => setSearch(event.target.value)}
                ariaLabel="Search records"
              />
            <div className="relative otli-filter-control shrink-0" ref={filterRef}>
              <TableFilterButton open={showFilters} onClick={() => setShowFilters((current) => !current)} label="Filters" />
              {showFilters && (
                <FilterDropdownPortal open={showFilters} anchorRef={filterRef} onClose={() => setShowFilters(false)} className="w-[310px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <p className="text-sm font-black text-slate-950">Filter Storage</p>
                    <button type="button" onClick={() => { handleAreaChange(""); setSelectedLoadStatus("all"); setSelectedRateType("all"); setSearch("") }} className="text-xs font-black text-emerald-700">Reset</button>
                  </div>
                  <div className="mt-4 space-y-4">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Yard Area</span>
                      <select className="input !py-3" value={selectedAreaId} onChange={(event) => handleAreaChange(event.target.value)}>
                        <option value="">All yard areas</option>
                        {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Block</span>
                      <select className="input !py-3" value={selectedBlockId} onChange={(event) => setSelectedBlockId(event.target.value)} disabled={!selectedAreaId}>
                        <option value="">All blocks</option>
                        {blocks.map((block) => <option key={block.id} value={block.id}>{block.code || block.name}</option>)}
                      </select>
                    </label>
                    <ContainerClassificationFilters
                      loadStatus={selectedLoadStatus}
                      rateType={selectedRateType}
                      onLoadStatusChange={setSelectedLoadStatus}
                      onRateTypeChange={setSelectedRateType}
                    />
                  </div>
                </FilterDropdownPortal>
              )}
            </div>
          </TableToolbar>
        </div>
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">{tableLoading ? "Loading stored containers..." : `Showing ${tableContainers.length} of ${matchingTotal} matching containers (${storageOccupancy.totalContainers || 0} total in storage)`}</div>
        <div className="space-y-3 p-3 md:hidden" aria-label="Stored container records">
          {tableContainers.map((container) => {
            const displayStatus = container.bookingStatus || container.status
            const storageDate = container.storageStartDate || container.storedAt || container.updatedAt
            return (
              <OperationalRecordCard
                key={container.id}
                eyebrow={container.bookingReference || container.preAdviceNumber || "Storage record"}
                title={container.containerNumber}
                subtitle={container.clientName || "Client"}
                onOpen={() => setSelectedStorageContainer(container)}
                actions={
                  <TableCrudActions
                    recordLabel={container.containerNumber}
                    onView={() => setSelectedStorageContainer(container)}
                    editDisabled
                    deleteDisabled
                    editLabel="Stored container locations are edited from Inventory"
                    deleteLabel="Stored containers cannot be deleted from Monitoring"
                  />
                }
                status={
                  <>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(displayStatus)}`}>{statusLabels[displayStatus] || displayStatus?.replaceAll("_", " ")}</span>
                    {container.isOverstaying && <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">Overstaying</span>}
                  </>
                }
              >
                <RecordCardField label="Yard location">{[container.areaName || "Not assigned", container.blockCode || container.blockName, container.slotNumber ? `Slot ${container.slotNumber}` : "No slot"].filter(Boolean).join(" · ")}</RecordCardField>
                <RecordCardField label="Size / type">{container.containerSize}ft · {String(container.containerType || "").replaceAll("_", " ")}</RecordCardField>
                <RecordCardField label="Classification"><ContainerClassificationBadges loadStatus={container.containerLoadStatus || container.containerStatus} rateType={container.rateType} compact /></RecordCardField>
                <RecordCardField label="Storage start">{formatDate(storageDate)}</RecordCardField>
                <RecordCardField label="Days in yard">{daysInYard(storageDate)}</RecordCardField>
              </OperationalRecordCard>
            )
          })}
          {!tableLoading && tableContainers.length === 0 && <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">No stored containers match the selected view.</p>}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table data-mobile-view="scroll" className="otli-data-table w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-3">Container</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Area / Block / Slot</th><th className="px-5 py-3">Size / Type</th><th className="px-5 py-3">Storage Start</th><th className="px-5 py-3">Days</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableLoading && tableContainers.length === 0 && <TableLoadingRow colSpan={8} rows={6} actionColumn label="Loading storage containers" />}
              {tableContainers.length === 0 && !tableLoading && <tr><td colSpan="8" className="px-5 py-12 text-center font-semibold text-slate-500">No stored containers found for the selected view.</td></tr>}
              {tableContainers.map((container) => {
                const displayStatus = container.bookingStatus || container.status
                const storageDate = container.storageStartDate || container.storedAt || container.updatedAt
                return (
                  <tr key={container.id} className="align-top transition hover:bg-slate-50/80">
                    <td className="px-5 py-4"><div className="font-black text-slate-950">{container.containerNumber}</div><div className="text-xs font-semibold text-slate-500">{container.bookingReference || container.preAdviceNumber || "-"}</div>{container.recordSource === "legacy_migration" && <span className="mt-2 inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-violet-700">Legacy Record</span>}</td>
                    <td className="px-5 py-4 font-semibold text-slate-600">{container.clientName || "-"}</td>
                    <td className="px-5 py-4 font-semibold text-slate-600"><div>{container.areaName || "No area"}</div><div className="text-xs text-slate-500">{container.blockCode || container.blockName || "No block"} • {container.slotNumber || "No slot"}</div></td>
                    <td className="px-5 py-4 font-semibold text-slate-600">
                      <div>{container.containerSize}ft • {container.containerType?.replace("_", " ")}</div>
                      <ContainerClassificationBadges loadStatus={container.containerLoadStatus || container.containerStatus} rateType={container.rateType} className="mt-2" compact />
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-600"><CalendarClock className="mr-1 inline" size={14} /> {formatDate(storageDate)}</td>
                    <td className="px-5 py-4 font-black text-slate-950">{daysInYard(storageDate)}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(displayStatus)}`}>{statusLabels[displayStatus] || displayStatus?.replaceAll("_", " ")}</span>
                      {container.isOverstaying && <span className="mt-2 inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700">Overstaying</span>}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <TableCrudActions
                        recordLabel={container.containerNumber}
                        onView={() => setSelectedStorageContainer(container)}
                        editDisabled
                        deleteDisabled
                        editLabel="Stored container locations are edited from the Inventory module"
                        deleteLabel="Stored container records cannot be deleted from monitoring"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Pagination {...tablePagination} />
      </section>


      {selectedStorageContainer && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Storage Details</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">{selectedStorageContainer.containerNumber}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">{selectedStorageContainer.bookingReference || selectedStorageContainer.preAdviceNumber || "No booking reference"}</p>
                <ContainerClassificationBadges loadStatus={selectedStorageContainer.containerLoadStatus || selectedStorageContainer.containerStatus} rateType={selectedStorageContainer.rateType} className="mt-3" />
                {selectedStorageContainer.recordSource === "legacy_migration" && <span className="mt-3 inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-violet-700">Legacy / Migrated Record</span>}
              </div>
              <ModalCloseButton onClick={() => setSelectedStorageContainer(null)} label="Close storage details" />
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
              <StorageDetail label="Customer" value={selectedStorageContainer.clientName} />
              <StorageDetail label="Status" value={statusLabels[selectedStorageContainer.bookingStatus || selectedStorageContainer.status] || selectedStorageContainer.bookingStatus || selectedStorageContainer.status} />
              <StorageDetail label="Container" value={`${selectedStorageContainer.containerSize}ft • ${String(selectedStorageContainer.containerType || "").replaceAll("_", " ")}`} />
              <StorageDetail label="Load Status" value={(selectedStorageContainer.containerLoadStatus || selectedStorageContainer.containerStatus) === "laden" ? "Laden" : (selectedStorageContainer.containerLoadStatus || selectedStorageContainer.containerStatus) === "empty" ? "Empty" : "Unknown"} />
              <StorageDetail label="Rate Classification" value={selectedStorageContainer.rateType === "international" ? "International" : "Local"} />
              <StorageDetail label="Record Source" value={selectedStorageContainer.recordSource === "legacy_migration" ? "Legacy Migration" : "Client Booking"} />
              <StorageDetail label="Yard Area" value={selectedStorageContainer.areaName} />
              <StorageDetail label="Block" value={selectedStorageContainer.blockCode || selectedStorageContainer.blockName} />
              <StorageDetail label="Slot" value={selectedStorageContainer.slotNumber} />
              <StorageDetail label="Storage Start" value={formatDate(selectedStorageContainer.storageStartDate || selectedStorageContainer.storedAt || selectedStorageContainer.updatedAt)} />
              <StorageDetail label="Days in Yard" value={daysInYard(selectedStorageContainer.storageStartDate || selectedStorageContainer.storedAt || selectedStorageContainer.updatedAt)} />
              <StorageDetail label="Scheduled Gate-Out" value={formatDate(selectedStorageContainer.outDate)} />
              <StorageDetail label="Gate-Out Schedule" value={selectedStorageContainer.isOverstaying ? "Overstaying" : selectedStorageContainer.gateOutScheduleStatus} />
              <StorageDetail label="Overstay Started" value={formatDate(selectedStorageContainer.gateOutOverstayStartedAt)} />
              <StorageDetail label="Last Updated" value={formatDate(selectedStorageContainer.updatedAt)} />
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

const StorageDetail = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <div className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</div>
    <div className="mt-1 break-words text-sm font-bold text-slate-800">{value || "N/A"}</div>
  </div>
)

export default AdminStorageMonitoring
