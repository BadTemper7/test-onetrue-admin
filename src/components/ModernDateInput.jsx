import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import { CalendarDays, ChevronDown } from "lucide-react"

const pad = (value) => String(value).padStart(2, "0")

const parseDateValue = (value) => {
  if (!value) return null

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const normalizedValue = String(value)

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    const [year, month, day] = normalizedValue.split("-").map(Number)
    return new Date(year, month - 1, day)
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(normalizedValue)) {
    const [datePart, timePart] = normalizedValue.split("T")
    const [year, month, day] = datePart.split("-").map(Number)
    const [hours, minutes] = timePart.split(":").map(Number)
    return new Date(year, month - 1, day, hours || 0, minutes || 0)
  }

  const parsed = new Date(normalizedValue)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const formatForInput = (date, type) => {
  if (!date || Number.isNaN(date.getTime())) return ""

  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())

  if (type === "date") return `${year}-${month}-${day}`

  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

const ModernDateInput = ({
  label,
  hint,
  value,
  onChange,
  name,
  type = "datetime-local",
  required = false,
  min,
  max,
  disabled = false,
  placeholder,
}) => {
  const isDateOnly = type === "date"
  const selectedDate = parseDateValue(value)
  const minDate = parseDateValue(min)
  const maxDate = parseDateValue(max)

  const emitChange = (date) => {
    const nextValue = formatForInput(date, type)
    onChange?.({ target: { name, value: nextValue } })
  }

  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>}
      <div className="modern-date-picker">
        <div className="modern-date-icon">
          <CalendarDays size={18} />
        </div>
        <DatePicker
          selected={selectedDate}
          onChange={emitChange}
          showTimeSelect={!isDateOnly}
          timeIntervals={15}
          timeCaption="Time"
          dateFormat={isDateOnly ? "MMM d, yyyy" : "MMM d, yyyy h:mm aa"}
          placeholderText={placeholder || (isDateOnly ? "Select date" : "Select date and time")}
          minDate={minDate || undefined}
          maxDate={maxDate || undefined}
          disabled={disabled}
          name={name}
          required={required}
          isClearable={!required && Boolean(value)}
          className="modern-date-input"
          calendarClassName="otli-datepicker-calendar"
          popperClassName="otli-datepicker-popper"
          wrapperClassName="modern-date-wrapper"
          popperPlacement="bottom-start"
          autoComplete="off"
          shouldCloseOnSelect={isDateOnly}
        />
        <div className="modern-date-caret">
          <ChevronDown size={16} />
        </div>
      </div>
      {hint && <span className="mt-1.5 block text-xs font-bold text-slate-400">{hint}</span>}
    </label>
  )
}

export default ModernDateInput
