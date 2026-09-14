// components/ui/Select.jsx
import React from "react";
import { FiChevronDown } from "react-icons/fi";

const Select = ({
  label,
  name,
  value,
  onChange,
  options,
  error,
  placeholder = "Select an option",
  required = false,
  disabled = false,
  icon,
  className = "",
  labelClassName = "",
  containerClassName = "",
  onBlur,
  onFocus,
  id,
  size = "md",
  helperText,
}) => {
  // Size configurations
  const sizeClasses = {
    sm: "px-2.5 py-1.5 text-sm",
    md: "px-3 py-2 text-sm",
    lg: "px-4 py-2.5 text-base",
  };

  // Base select classes
  const selectClasses = `
    w-full rounded-lg border transition-all duration-200 appearance-none
    ${sizeClasses[size] || sizeClasses.md}
    ${icon ? "pl-10" : "pl-3"}
    ${
      error
        ? "border-red-300 focus:ring-red-500 focus:border-red-500 bg-red-50"
        : "border-gray-300 focus:ring-emerald-500 focus:border-emerald-500 hover:border-gray-400"
    }
    ${disabled ? "bg-gray-100 cursor-not-allowed opacity-70" : "bg-white cursor-pointer"}
    focus:outline-none focus:ring-2 focus:ring-opacity-50
    ${className}
  `;

  return (
    <div className={`space-y-1.5 ${containerClassName}`}>
      {label && (
        <label
          htmlFor={id || name}
          className={`block text-sm font-medium text-gray-700 ${labelClassName}`}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
            {React.cloneElement(icon, {
              className: `h-5 w-5 ${error ? "text-red-400" : "text-gray-400"}`,
            })}
          </div>
        )}

        <select
          id={id || name}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          onFocus={onFocus}
          disabled={disabled}
          required={required}
          className={selectClasses}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled || false}
            >
              {option.label}
            </option>
          ))}
        </select>

        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <FiChevronDown
            className={`h-5 w-5 transition-transform duration-200 ${
              error ? "text-red-400" : "text-gray-400"
            }`}
          />
        </div>
      </div>

      {error && (
        <p
          id={`${name}-error`}
          className="text-xs text-red-500 mt-1 flex items-center"
        >
          <span className="mr-1">•</span>
          {error}
        </p>
      )}

      {/* Helper text */}
      {!error && helperText && (
        <p className="text-xs text-gray-500 mt-1">{helperText}</p>
      )}
    </div>
  );
};

export default Select;
