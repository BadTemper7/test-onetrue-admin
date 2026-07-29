import React, { useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { FiClock, FiAlertCircle } from "react-icons/fi";

const InputTime = ({
  label,
  name,
  value,
  onChange,
  onBlur,
  placeholder = "Select time",
  required = false,
  disabled = false,
  error = "",
  className = "",
  labelClassName = "",
  timeFormat = "HH:mm",
  timeIntervals = 30,
  minTime = null,
  maxTime = null,
  helperText = "",
  size = "md",
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const sizes = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-3 text-base",
    lg: "px-5 py-4 text-lg",
  };

  const customInput = (
    <div className="relative">
      <input
        id={name}
        value={
          value
            ? new Date(value).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : ""
        }
        placeholder={placeholder}
        readOnly
        className={`
          w-full 
          border rounded-lg 
          focus:outline-none transition duration-200 cursor-pointer
          ${sizes[size]}
          ${error ? "border-red-500 focus:ring-2 focus:ring-red-500 focus:border-transparent" : ""}
          ${!error ? "border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent" : ""}
          ${disabled ? "bg-gray-100 cursor-not-allowed opacity-60" : "bg-white"}
          ${error ? "pr-10" : "pl-10"}
        `}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      <FiClock
        className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 ${
          error ? "text-red-500" : "text-gray-400"
        }`}
      />

      {error && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <FiAlertCircle className="h-5 w-5 text-red-500" />
        </div>
      )}
    </div>
  );

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          htmlFor={name}
          className={`block text-sm font-medium text-gray-700 mb-1.5 ${labelClassName}`}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <DatePicker
        selected={value}
        onChange={(date) => {
          onChange({ target: { name, value: date } });
        }}
        onBlur={onBlur}
        showTimeSelect
        showTimeSelectOnly
        timeFormat={timeFormat}
        timeIntervals={timeIntervals}
        placeholderText={placeholder}
        disabled={disabled}
        minTime={minTime}
        maxTime={maxTime}
        customInput={customInput}
        open={isOpen}
        onCalendarOpen={() => setIsOpen(true)}
        onCalendarClose={() => setIsOpen(false)}
        onClickOutside={() => setIsOpen(false)}
        shouldCloseOnSelect
        {...props}
      />

      {/* Inline Error Message */}
      {error && (
        <div className="mt-1.5 flex items-start space-x-1.5">
          <FiAlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p id={`${name}-error`} className="text-sm text-red-500">
            {error}
          </p>
        </div>
      )}

      {/* Helper Text */}
      {helperText && !error && (
        <p className="mt-1.5 text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
};

export default InputTime;
