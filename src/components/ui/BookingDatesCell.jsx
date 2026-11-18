const displayDate = (value) => {
  if (!value) return "Not recorded"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleDateString()
}

const BookingDatesCell = ({ inDate, expectedArrivalDate, outDate }) => {
  const hasActualInDate = Boolean(inDate)
  const arrivalDate = inDate || expectedArrivalDate
  const inboundLabel = hasActualInDate || !expectedArrivalDate ? "Date In" : "Expected In"

  return (
    <dl className="space-y-2.5 text-xs">
      <div className="flex items-baseline gap-2">
        <dt className="w-[72px] shrink-0 font-bold text-slate-500">{inboundLabel}</dt>
        <dd className="whitespace-nowrap font-semibold text-slate-800">{displayDate(arrivalDate)}</dd>
      </div>
      <div className="flex items-baseline gap-2">
        <dt className="w-[72px] shrink-0 font-bold text-slate-500">Date Out</dt>
        <dd className={`whitespace-nowrap ${outDate ? "font-semibold text-slate-800" : "text-slate-400"}`}>
          {outDate ? displayDate(outDate) : "Pending"}
        </dd>
      </div>
    </dl>
  )
}

export default BookingDatesCell
