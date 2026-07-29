import { useEffect, useMemo, useRef, useState } from "react"
import { Boxes, CalendarClock, Layers3, RefreshCw, Rotate3D, Search, SlidersHorizontal, Warehouse } from "lucide-react"
import Alert from "../../components/Alert"
import { api, getApiError } from "../../lib/api"
import Pagination from "../../components/ui/Pagination"
import { usePagination } from "../../hooks/usePagination"
import { useClickOutside } from "../../hooks/useClickOutside"

const MAP_WIDTH = 980
const MAP_HEIGHT = 600

const storedBookingStatuses = ["stored_in_assigned_area", "gate_out_requested", "gate_out_approved"]
const storedInventoryStatuses = ["in_yard", "for_billing", "pending_payment", "payment_verified", "cleared_for_gate_out", "hold"]

const statusLabels = {
  in_yard: "In Yard",
  hold: "Hold",
  gate_in_approved: "Gate-In Approved",
  stored_in_assigned_area: "Stored in Assigned Area",
  gate_out_requested: "Gate-Out Requested",
  gate_out_approved: "Gate-Out Approved",
  completed_gate_out_done: "Completed / Gate-Out Done",
}

const statusClass = (status) => {
  if (["in_yard", "stored_in_assigned_area"].includes(status)) return "bg-blue-50 text-blue-700"
  if (["gate_out_requested", "gate_out_approved"].includes(status)) return "bg-blue-50 text-blue-700"
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

const getYardCapacityUsage = (containerSize, yardContainerSize = 20) => {
  const size = Number(containerSize) || 20
  const yardSize = Number(yardContainerSize) || 20
  if (yardSize === 20) {
    return size === 40 ? 2 : 1
  }
  return size === 20 ? 0.5 : 1
}

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

const groupContainersByBlock = (containers) => {
  return containers.reduce((acc, container) => {
    if (!container.block) return acc
    if (!acc[container.block]) acc[container.block] = []
    acc[container.block].push(container)
    return acc
  }, {})
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

const AreaList = ({ areas, selectedAreaId, onSelectArea, containers }) => {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2">
        <Warehouse size={18} className="text-emerald-700" />
        <h2 className="text-lg font-black text-slate-950">Yard Areas</h2>
      </div>
      <p className="mt-1 text-sm font-medium text-slate-500">Click an area to show its blocks and 3D container allocation.</p>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {areas.length === 0 && <div className="rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">No yard areas yet.</div>}
        {areas.map((area) => {
          const areaContainers = containers.filter((container) => container.area === area.id)
          const total = numberValue(area.totalTeuSlots || area.capacityTeu, 0)
          const used = areaContainers.reduce((sum, container) => sum + getYardCapacityUsage(container.containerSize, area.containerSize), 0)
          const usage = total ? clamp(Math.round((used / total) * 100), 0, 100) : 0
          const active = selectedAreaId === area.id

          return (
            <button
              key={area.id}
              type="button"
              onClick={() => onSelectArea(area.id)}
              className={`rounded-3xl border p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${active ? "border-emerald-400 bg-emerald-50 ring-4 ring-emerald-100" : "border-slate-200 bg-white"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xl font-black text-slate-950">{area.name}</div>
                  <div className="mt-1 text-xs font-black uppercase tracking-wide text-slate-400">{area.containerSize}ft • {getSlotCounts({}, area).bayCount} Bay / {getSlotCounts({}, area).rowCount} Row / {getSlotCounts({}, area).tierCount} Tier</div>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-emerald-700 shadow-sm">{areaContainers.length} CNTR</span>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs font-black text-slate-500">
                <span>{Math.round(used * 100) / 100} / {total} {getCapacityUnit(area.containerSize)}</span>
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

const BlockList = ({ selectedArea, blocks, selectedBlockId, onSelectBlock, containers }) => {
  const containersByBlock = useMemo(() => groupContainersByBlock(containers), [containers])

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
          <p className="mt-1 text-sm font-medium text-slate-500">Click a block to focus the 3D viewer on containers in that block.</p>
        </div>
        <button type="button" onClick={() => onSelectBlock("")} className={`rounded-2xl px-4 py-2 text-sm font-black ${!selectedBlockId ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
          View all blocks
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {blocks.length === 0 && <div className="rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">No blocks configured for this area.</div>}
        {blocks.map((block) => {
          const blockContainers = containersByBlock[block.id] || []
          const total = numberValue(block.teuSlots || block.capacityTeu, 0)
          const used = blockContainers.reduce((sum, container) => sum + getYardCapacityUsage(container.containerSize, block.containerSize || selectedArea?.containerSize), 0)
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
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-emerald-700 shadow-sm">{blockContainers.length} CNTR</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-black text-slate-600">
                <div className="rounded-xl bg-slate-50 p-2">{getSlotCounts(block, selectedArea).bayCount}<br /><span className="text-[10px] uppercase text-slate-400">Bay</span></div>
                <div className="rounded-xl bg-slate-50 p-2">{getSlotCounts(block, selectedArea).rowCount}<br /><span className="text-[10px] uppercase text-slate-400">Row</span></div>
                <div className="rounded-xl bg-slate-50 p-2">{getSlotCounts(block, selectedArea).tierCount}<br /><span className="text-[10px] uppercase text-slate-400">Tier</span></div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs font-black text-slate-500">
                <span>{Math.round(used * 100) / 100} / {total} {getCapacityUnit(block.containerSize || selectedArea?.containerSize)}</span>
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

const Storage3DViewer = ({ selectedArea, selectedBlockId, blocks, containers }) => {
  const visibleBlocks = selectedBlockId ? blocks.filter((block) => block.id === selectedBlockId) : blocks
  const focusedBlock = selectedBlockId ? visibleBlocks[0] : visibleBlocks.length === 1 ? visibleBlocks[0] : null
  const blockContainers = focusedBlock ? containers.filter((container) => container.block === focusedBlock.id) : []
  const { bayCount, rowCount, tierCount } = getSlotCounts(focusedBlock || {}, selectedArea || {})

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50/60 p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <SlotSummaryCard label="Block" value={focusedBlock?.code || selectedArea?.name || "-"} sublabel={focusedBlock?.name || "Selected yard block"} icon={Boxes} />
          <SlotSummaryCard label="Bays" value={focusedBlock ? bayCount : "-"} icon={Layers3} />
          <SlotSummaryCard label="Rows" value={focusedBlock ? rowCount : "-"} icon={Layers3} />
          <SlotSummaryCard label="Tiers" value={focusedBlock ? tierCount : "-"} icon={Layers3} />
        </div>
      </div>

      <div className="p-5">
        {!selectedArea && (
          <div className="grid min-h-[420px] place-items-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 text-center">
            <div>
              <Warehouse className="mx-auto text-slate-300" size={46} />
              <div className="mt-3 text-xl font-black text-slate-800">Select a yard area</div>
              <div className="mt-1 text-sm font-semibold text-slate-500">The block slot map will appear after selecting an area.</div>
            </div>
          </div>
        )}

        {selectedArea && visibleBlocks.length === 0 && (
          <div className="grid min-h-[420px] place-items-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 text-center">
            <div>
              <Boxes className="mx-auto text-slate-300" size={46} />
              <div className="mt-3 text-xl font-black text-slate-800">No blocks configured</div>
              <div className="mt-1 text-sm font-semibold text-slate-500">Create blocks in Yard Area setup to view the slot map.</div>
            </div>
          </div>
        )}

        {selectedArea && visibleBlocks.length > 1 && !selectedBlockId && (
          <div className="grid min-h-[420px] place-items-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 text-center">
            <div>
              <Layers3 className="mx-auto text-slate-300" size={46} />
              <div className="mt-3 text-xl font-black text-slate-800">Select a block</div>
              <div className="mt-1 max-w-xl text-sm font-semibold text-slate-500">Choose a block from the block list above to display the exact Bay, Row, and Tier slot map.</div>
            </div>
          </div>
        )}

        {focusedBlock && <BlockSlotMap selectedArea={selectedArea} block={focusedBlock} containers={blockContainers} />}
      </div>
    </div>
  )
}

const AdminStorageMonitoring = () => {
  const [areas, setAreas] = useState([])
  const [blocks, setBlocks] = useState([])
  const [containers, setContainers] = useState([])
  const [selectedAreaId, setSelectedAreaId] = useState("")
  const [selectedBlockId, setSelectedBlockId] = useState("")
  const [search, setSearch] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const filterRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [alert, setAlert] = useState({ type: "", message: "" })

  useClickOutside(filterRef, () => setShowFilters(false), showFilters)

  const selectedArea = useMemo(() => areas.find((area) => area.id === selectedAreaId) || null, [areas, selectedAreaId])

  const storedContainers = useMemo(() => {
    const term = search.trim().toLowerCase()
    return containers.filter((container) => {
      const storedByBooking = storedBookingStatuses.includes(container.bookingStatus)
      const storedByInventory = storedInventoryStatuses.includes(container.status)
      const matchesSearch = !term || [container.containerNumber, container.bookingReference, container.clientName, container.areaName, container.blockCode, container.blockName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
      return (storedByBooking || storedByInventory) && matchesSearch
    })
  }, [containers, search])

  const selectedAreaContainers = useMemo(() => {
    return selectedAreaId ? storedContainers.filter((container) => container.area === selectedAreaId) : storedContainers
  }, [storedContainers, selectedAreaId])

  const selectedBlockContainers = useMemo(() => {
    return selectedBlockId ? selectedAreaContainers.filter((container) => container.block === selectedBlockId) : selectedAreaContainers
  }, [selectedAreaContainers, selectedBlockId])

  const storagePagination = usePagination(
    selectedBlockContainers,
    10,
    `${selectedAreaId}|${selectedBlockId}|${search}`,
  )

  const usedCapacity = useMemo(() => {
    if (selectedArea) {
      const unit = getCapacityUnit(selectedArea.containerSize)
      const value = selectedAreaContainers.reduce(
        (sum, container) => sum + getYardCapacityUsage(container.containerSize, selectedArea.containerSize),
        0,
      )

      return { label: `Used ${unit}`, value }
    }

    const value = selectedAreaContainers.reduce(
      (sum, container) => sum + getYardCapacityUsage(container.containerSize, 20),
      0,
    )

    return { label: "Used TEU Equivalent", value }
  }, [selectedArea, selectedAreaContainers])

  const loadAreas = async () => {
    const { data } = await api.get("/admin/inventory/areas")
    setAreas(data.areas || [])
  }

  const loadBlocks = async (areaId = selectedAreaId) => {
    if (!areaId) {
      setBlocks([])
      return
    }
    const { data } = await api.get(`/admin/inventory/areas/${areaId}/blocks`)
    setBlocks(data.blocks || [])
  }

  const loadContainers = async () => {
    const { data } = await api.get("/admin/inventory/containers")
    setContainers(data.containers || [])
  }

  const loadAll = async () => {
    try {
      setLoading(true)
      setAlert({ type: "", message: "" })
      await Promise.all([loadAreas(), loadContainers()])
      if (selectedAreaId) await loadBlocks(selectedAreaId)
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    if (!selectedAreaId) {
      setBlocks([])
      setSelectedBlockId("")
      return
    }

    setSelectedBlockId("")
    loadBlocks(selectedAreaId).catch((error) => setAlert({ type: "error", message: getApiError(error) }))
  }, [selectedAreaId])

  useEffect(() => {
    const handleRealtime = (event) => {
      const eventType = event.detail?.type || ""
      if (!eventType.startsWith("booking:") && !eventType.startsWith("storage:") && !eventType.startsWith("inventory:") && !eventType.startsWith("yard:")) return
      loadAll()
    }

    window.addEventListener("otli:realtime", handleRealtime)
    return () => window.removeEventListener("otli:realtime", handleRealtime)
  }, [selectedAreaId])

  const handleRefresh = async () => {
    await loadAll()
  }

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-emerald-700"><Warehouse size={15} /> Yard Module</div>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Storage Monitoring</h2>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-500">Review stored containers, assigned yard locations, storage duration, and visual block allocation from one monitoring page.</p>
          </div>
          <button type="button" onClick={handleRefresh} className="btn-secondary shrink-0" disabled={loading}><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh</button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <StatCard label="Selected Area" value={selectedArea?.name || "All Areas"} icon={Warehouse} tone="slate" />
          <StatCard label="Stored Containers" value={selectedAreaContainers.length} icon={Boxes} tone="blue" />
          <StatCard label={usedCapacity.label} value={Math.round(usedCapacity.value * 100) / 100} icon={CalendarClock} tone="emerald" />
        </div>
        <div className="mt-4"><Alert type={alert.type}>{alert.message}</Alert></div>
      </section>

      <section className="card overflow-visible">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-950">Stored Container List</h3>
            <p className="text-sm font-semibold text-slate-500">Search and filter stored containers before reviewing the visual yard allocation.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input className="input w-full !rounded-2xl !py-3 !pl-10 !pr-4 text-sm sm:w-[340px]" placeholder="Search container, booking, customer..." value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <div className="relative" ref={filterRef}>
              <button type="button" onClick={() => setShowFilters((current) => !current)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 sm:w-auto">
                <SlidersHorizontal size={18} /> Filters
              </button>
              {showFilters && (
                <div className="absolute right-0 z-40 mt-2 w-[310px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <p className="text-sm font-black text-slate-950">Filter Storage</p>
                    <button type="button" onClick={() => { setSelectedAreaId(""); setSelectedBlockId("") }} className="text-xs font-black text-emerald-700">Reset</button>
                  </div>
                  <div className="mt-4 space-y-4">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Yard Area</span>
                      <select className="input !py-3" value={selectedAreaId} onChange={(event) => setSelectedAreaId(event.target.value)}>
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
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">Showing {selectedBlockContainers.length} stored containers</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-3">Container</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Area / Block / Slot</th><th className="px-5 py-3">Size / Type</th><th className="px-5 py-3">Storage Start</th><th className="px-5 py-3">Days</th><th className="px-5 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {selectedBlockContainers.length === 0 && !loading && <tr><td colSpan="7" className="px-5 py-12 text-center font-semibold text-slate-500">No stored containers found for the selected view.</td></tr>}
              {storagePagination.paginatedItems.map((container) => {
                const displayStatus = container.bookingStatus || container.status
                const storageDate = container.storageStartDate || container.storedAt || container.updatedAt
                return (
                  <tr key={container.id} className="align-top transition hover:bg-slate-50/80">
                    <td className="px-5 py-4"><div className="font-black text-slate-950">{container.containerNumber}</div><div className="text-xs font-semibold text-slate-500">{container.bookingReference || container.preAdviceNumber || "-"}</div></td>
                    <td className="px-5 py-4 font-semibold text-slate-600">{container.clientName || "-"}</td>
                    <td className="px-5 py-4 font-semibold text-slate-600"><div>{container.areaName || "No area"}</div><div className="text-xs text-slate-500">{container.blockCode || container.blockName || "No block"} • {container.slotNumber || "No slot"}</div></td>
                    <td className="px-5 py-4 font-semibold text-slate-600">{container.containerSize}ft • {container.containerType?.replace("_", " ")}</td>
                    <td className="px-5 py-4 font-semibold text-slate-600"><CalendarClock className="mr-1 inline" size={14} /> {formatDate(storageDate)}</td>
                    <td className="px-5 py-4 font-black text-slate-950">{daysInYard(storageDate)}</td>
                    <td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(displayStatus)}`}>{statusLabels[displayStatus] || displayStatus?.replaceAll("_", " ")}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Pagination {...storagePagination} />
      </section>

      <section className="card p-5">
        <div className="flex items-center gap-2">
          <Layers3 size={18} className="text-emerald-700" />
          <div><h3 className="text-lg font-black text-slate-950">Visual Storage Overview</h3><p className="text-sm font-semibold text-slate-500">Select an area and block to inspect container placement.</p></div>
        </div>
      </section>

      <AreaList areas={areas} selectedAreaId={selectedAreaId} onSelectArea={setSelectedAreaId} containers={storedContainers} />
      <BlockList selectedArea={selectedArea} blocks={blocks} selectedBlockId={selectedBlockId} onSelectBlock={setSelectedBlockId} containers={selectedAreaContainers} />
      <Storage3DViewer selectedArea={selectedArea} selectedBlockId={selectedBlockId} blocks={blocks} containers={selectedBlockContainers} />
    </div>
  )
}

export default AdminStorageMonitoring
