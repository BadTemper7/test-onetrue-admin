import { useEffect } from "react"

const EXCLUDED_TYPES = new Set(["button", "submit", "reset", "hidden", "image"])

const toTitle = (value = "") =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase())

const getFieldLabel = (field) => {
  const explicitLabel = field.id ? document.querySelector(`label[for="${CSS.escape(field.id)}"]`) : null
  const wrappingLabel = field.closest("label")
  const nearbyLabel = field.parentElement?.querySelector?.("label") || field.closest("div")?.querySelector?.("label")
  const labelText = explicitLabel?.textContent || wrappingLabel?.querySelector("span")?.textContent || wrappingLabel?.textContent || nearbyLabel?.textContent
  const placeholder = field.getAttribute("placeholder")
  const ariaLabel = field.getAttribute("aria-label")
  const name = field.getAttribute("name")

  return toTitle((labelText || placeholder || ariaLabel || name || "This field").replace("*", "")) || "This field"
}

const isFieldCandidate = (element) => {
  if (!element || !element.matches?.("input, select, textarea")) return false
  if (!element.form) return false
  if (element.disabled || element.readOnly) return false
  if (element.closest("[data-skip-field-validation]")) return false

  const type = (element.getAttribute("type") || "").toLowerCase()
  return !EXCLUDED_TYPES.has(type)
}

const getCustomMessage = (field) => {
  const label = getFieldLabel(field)
  const value = String(field.value || "").trim()
  const name = String(field.getAttribute("name") || "").toLowerCase()
  const placeholder = String(field.getAttribute("placeholder") || "").toLowerCase()
  const type = String(field.getAttribute("type") || "").toLowerCase()

  const isConfirmPassword = type === "password" && (name.includes("confirm") || placeholder.includes("confirm"))
  if (isConfirmPassword && value) {
    const passwordField = Array.from(field.form.querySelectorAll('input[type="password"]')).find((input) => input !== field && !String(input.getAttribute("name") || "").toLowerCase().includes("current"))
    if (passwordField?.value && passwordField.value !== field.value) return "Passwords do not match."
  }

  if (field.matches("input[type='tel']") && value && !/^09\d{9}$/.test(value)) {
    return `${label} must use this format: 09XXXXXXXXX.`
  }

  return ""
}

const getValidationMessage = (field) => {
  const label = getFieldLabel(field)
  const validity = field.validity
  const customMessage = getCustomMessage(field)

  if (customMessage) return customMessage
  if (validity.valueMissing) return `${label} is required.`
  if (validity.typeMismatch) {
    if (field.type === "email") return "Please enter a valid email address."
    if (field.type === "url") return "Please enter a valid URL."
    return `${label} is not valid.`
  }
  if (validity.patternMismatch) return field.getAttribute("title") || `${label} is not in the correct format.`
  if (validity.tooShort) return `${label} must be at least ${field.minLength} characters.`
  if (validity.tooLong) return `${label} must be ${field.maxLength} characters or less.`
  if (validity.rangeUnderflow) return `${label} must be at least ${field.min}.`
  if (validity.rangeOverflow) return `${label} must be ${field.max} or less.`
  if (validity.stepMismatch) return `${label} has an invalid value.`
  if (validity.badInput) return `${label} has an invalid value.`
  return field.validationMessage || `${label} is invalid.`
}

const getErrorId = (field) => {
  if (!field.id) {
    field.id = `field-${Math.random().toString(36).slice(2, 10)}`
  }
  return `${field.id}-error`
}

const getPlacementTarget = (field) => {
  const modernFileLabel = field.closest("label")?.querySelector("input[type='file']") ? field.closest("label") : null
  const dateWrapper = field.closest(".modern-date-picker")
  const controlWrapper = field.closest("[data-field-control]")
  return modernFileLabel || dateWrapper || controlWrapper || field
}

const removeFieldError = (field) => {
  if (!isFieldCandidate(field)) return

  const errorId = getErrorId(field)
  document.getElementById(errorId)?.remove()
  field.classList.remove("field-invalid")
  getPlacementTarget(field).classList.remove("field-invalid-target")
  field.removeAttribute("aria-invalid")

  const describedBy = String(field.getAttribute("aria-describedby") || "")
    .split(" ")
    .filter(Boolean)
    .filter((id) => id !== errorId)
    .join(" ")

  if (describedBy) field.setAttribute("aria-describedby", describedBy)
  else field.removeAttribute("aria-describedby")
}

const showFieldError = (field) => {
  if (!isFieldCandidate(field)) return true

  const customMessage = getCustomMessage(field)
  const isInvalid = Boolean(customMessage) || !field.checkValidity()

  if (!isInvalid) {
    removeFieldError(field)
    return true
  }

  const errorId = getErrorId(field)
  const message = getValidationMessage(field)
  let error = document.getElementById(errorId)

  if (!error) {
    error = document.createElement("p")
    error.id = errorId
    error.className = "field-validation-error"
    error.setAttribute("role", "alert")
    getPlacementTarget(field).insertAdjacentElement("afterend", error)
  }

  error.textContent = message
  field.classList.add("field-invalid")
  getPlacementTarget(field).classList.add("field-invalid-target")
  field.setAttribute("aria-invalid", "true")

  const describedBy = new Set(String(field.getAttribute("aria-describedby") || "").split(" ").filter(Boolean))
  describedBy.add(errorId)
  field.setAttribute("aria-describedby", Array.from(describedBy).join(" "))

  return false
}

const validateForm = (form) => {
  const fields = Array.from(form.querySelectorAll("input, select, textarea")).filter(isFieldCandidate)
  const invalidFields = fields.filter((field) => !showFieldError(field))

  if (invalidFields.length) {
    invalidFields[0].focus({ preventScroll: true })
    invalidFields[0].scrollIntoView({ behavior: "smooth", block: "center" })
    return false
  }

  return true
}

const prepareForms = () => {
  document.querySelectorAll("form").forEach((form) => {
    form.noValidate = true
  })
}

const FormFieldValidation = () => {
  useEffect(() => {
    prepareForms()

    const observer = new MutationObserver(prepareForms)
    observer.observe(document.body, { childList: true, subtree: true })

    const handleBlur = (event) => {
      const field = event.target
      if (!isFieldCandidate(field)) return
      showFieldError(field)
    }

    const handleInput = (event) => {
      const field = event.target
      if (!isFieldCandidate(field)) return
      removeFieldError(field)
    }

    const handleSubmit = (event) => {
      const form = event.target
      if (!form?.matches?.("form")) return
      if (!validateForm(form)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    document.addEventListener("focusout", handleBlur, true)
    document.addEventListener("input", handleInput, true)
    document.addEventListener("change", handleInput, true)
    document.addEventListener("submit", handleSubmit, true)

    return () => {
      observer.disconnect()
      document.removeEventListener("focusout", handleBlur, true)
      document.removeEventListener("input", handleInput, true)
      document.removeEventListener("change", handleInput, true)
      document.removeEventListener("submit", handleSubmit, true)
    }
  }, [])

  return null
}

export default FormFieldValidation
