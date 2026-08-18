const ContainerClassificationFilters = ({
  loadStatus = "all",
  rateType = "all",
  onLoadStatusChange,
  onRateTypeChange,
  selectClassName = "input !py-3",
}) => (
  <>
    <label className="block">
      <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Container Load</span>
      <select className={selectClassName} value={loadStatus} onChange={(event) => onLoadStatusChange?.(event.target.value)}>
        <option value="all">All empty and laden</option>
        <option value="empty">Empty</option>
        <option value="laden">Laden</option>
      </select>
    </label>

    <label className="block">
      <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Rate Classification</span>
      <select className={selectClassName} value={rateType} onChange={(event) => onRateTypeChange?.(event.target.value)}>
        <option value="all">All local and international</option>
        <option value="local">Local</option>
        <option value="international">International</option>
      </select>
    </label>
  </>
)

export default ContainerClassificationFilters
