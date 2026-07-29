import React from "react";
import { FiEye, FiEyeOff, FiAlertCircle } from "react-icons/fi";

const InputText = ({
  label,
  name,
  value,
  onChange,
  onBlur,
  type = "text",
  placeholder = "",
  required = false,
  disabled = false,
  error = "",
  className = "",
  inputClassName = "",
  labelClassName = "",
  icon = null,
  iconPosition = "left",
  showPasswordToggle = false,
  onTogglePassword,
  success = false,
  helperText = "",
  size = "md",
  ...props
}) => {
  const sizes = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-3 text-base",
    lg: "px-5 py-4 text-lg",
  };

  const baseInputClasses = `
    w-full 
    border rounded-lg 
    focus:outline-none transition duration-200
    ${sizes[size]}
    ${error ? "border-red-500 focus:ring-2 focus:ring-red-500 focus:border-transparent" : ""}
    ${success ? "border-blue-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent" : ""}
    ${!error && !success ? "border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent" : ""}
    ${disabled ? "bg-gray-100 cursor-not-allowed opacity-60" : "bg-white"}
    ${icon && iconPosition === "left" ? "pl-10" : ""}
    ${icon && iconPosition === "right" ? "pr-10" : ""}
    ${showPasswordToggle ? "pr-12" : ""}
    ${error ? "pr-10" : ""}
    ${success ? "pr-10" : ""}
    ${inputClassName}
  `;

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

      <div className="relative" data-field-control>
        {icon && iconPosition === "left" && (
          <div
            className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${
              error ? "text-red-500" : "text-gray-400"
            }`}
          >
            {icon}
          </div>
        )}

        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={baseInputClasses}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
          {...props}
        />

        {icon && iconPosition === "right" && !error && !success && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}

        {showPasswordToggle && (
          <button
            type="button"
            onClick={onTogglePassword}
            className={`absolute ${error ? "right-10" : "right-3"} top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none`}
          >
            {type === "password" ? (
              <FiEye className="h-5 w-5" />
            ) : (
              <FiEyeOff className="h-5 w-5" />
            )}
          </button>
        )}

        {/* Error Icon */}
        {error && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <FiAlertCircle className="h-5 w-5 text-red-500" />
          </div>
        )}

        {/* Success Icon */}
        {success && !error && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <svg
              className="h-5 w-5 text-blue-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
      </div>

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

export default InputText;
