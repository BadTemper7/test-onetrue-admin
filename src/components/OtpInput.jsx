const OtpInput = ({ value, onChange, disabled }) => {
  const chars = value.padEnd(6, " ").slice(0, 6).split("")

  const focusAt = (index) => {
    const input = document.querySelector(`[data-otp-index="${index}"]`)
    input?.focus()
    input?.select?.()
  }

  const updateAt = (index, nextValue) => {
    const cleaned = nextValue.replace(/\D/g, "").slice(-1)
    const next = value.padEnd(6, " ").split("")
    next[index] = cleaned || " "
    onChange(next.join("").replace(/\s/g, "").slice(0, 6))

    if (cleaned && index < 5) {
      focusAt(index + 1)
    }
  }

  const handlePaste = (event) => {
    event.preventDefault()
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    onChange(pasted)
    window.setTimeout(() => focusAt(Math.min(pasted.length, 5)), 0)
  }

  return (
    <div className="grid grid-cols-6 gap-2 sm:gap-3" onPaste={handlePaste}>
      {chars.map((char, index) => (
        <input
          key={index}
          data-otp-index={index}
          className="h-12 rounded-2xl border border-slate-300 bg-white text-center text-lg font-black text-slate-950 shadow-sm outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10 sm:h-14 sm:text-xl"
          value={char.trim()}
          disabled={disabled}
          inputMode="numeric"
          maxLength={1}
          autoComplete={index === 0 ? "one-time-code" : "off"}
          onChange={(event) => updateAt(index, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !event.currentTarget.value && index > 0) {
              focusAt(index - 1)
            }

            if (event.key === "ArrowLeft" && index > 0) {
              event.preventDefault()
              focusAt(index - 1)
            }

            if (event.key === "ArrowRight" && index < 5) {
              event.preventDefault()
              focusAt(index + 1)
            }
          }}
        />
      ))}
    </div>
  )
}

export default OtpInput
