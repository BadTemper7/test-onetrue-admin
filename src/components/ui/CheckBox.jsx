import React from "react";
import { FiCheck, FiAlertCircle } from "react-icons/fi";

const CheckBox = ({
  label,
  name,
  checked,
  onChange,
  onBlur,
  required = false,
  disabled = false,
  error = "",
  className = "",
  labelClassName = "",
  size = "md",
  helperText = "",
  ...props
}) => {
  const sizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  const labelSizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-start">
        <div className="flex items-center h-5 relative">
          <input
            id={name}
            name={name}
            type="checkbox"
            checked={checked}
            onChange={onChange}
            onBlur={onBlur}
            required={required}
            disabled={disabled}
            className={`
              ${sizes[size]}
              ${error ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-emerald-500"}
              text-yard-green 
              rounded 
              focus:ring-2 
              ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}
            `}
            aria-invalid={!!error}
            aria-describedby={error ? `${name}-error` : undefined}
            {...props}
          />
          {checked && !disabled && (
            <FiCheck
              className={`absolute ${iconSizes[size]} text-white pointer-events-none left-0.5 top-1/2 transform -translate-y-1/2`}
            />
          )}
        </div>

        {label && (
          <div className="ml-3">
            <label
              htmlFor={name}
              className={`
                font-medium text-gray-700 
                ${labelSizes[size]}
                ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}
                ${labelClassName}
              `}
            >
              {label}
              {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {helperText && !error && (
              <p className="text-sm text-gray-500">{helperText}</p>
            )}
          </div>
        )}
      </div>

      {/* Inline Error Message */}
      {error && (
        <div className="mt-1.5 flex items-start space-x-1.5 ml-8">
          <FiAlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p id={`${name}-error`} className="text-sm text-red-500">
            {error}
          </p>
        </div>
      )}
    </div>
  );
};

export default CheckBox;
