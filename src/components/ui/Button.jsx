import React from "react";
import { FiLoader } from "react-icons/fi";

const Button = ({
  children,
  type = "button",
  variant = "primary",
  size = "md",
  fullWidth = false,
  disabled = false,
  loading = false,
  onClick,
  className = "",
  icon = null,
  iconPosition = "left",
  ...props
}) => {
  const variants = {
    primary: "bg-yard-green hover:bg-emerald-700 text-white",
    secondary: "bg-gray-200 hover:bg-gray-300 text-gray-800",
    success: "bg-blue-600 hover:bg-blue-700 text-white",
    danger: "bg-red-600 hover:bg-red-700 text-white",
    warning: "bg-yellow-500 hover:bg-yellow-600 text-white",
    outline:
      "bg-transparent border-2 border-yard-green text-yard-green hover:bg-emerald-50",
    ghost: "bg-transparent hover:bg-gray-100 text-gray-700",
  };

  const sizes = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-3 text-base",
    lg: "px-6 py-4 text-lg",
  };

  const baseClasses = `
    font-semibold rounded-lg transition duration-200 
    focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
    ${variants[variant]}
    ${sizes[size]}
    ${fullWidth ? "w-full" : ""}
    ${loading ? "cursor-wait" : ""}
    ${className}
  `;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={baseClasses}
      {...props}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <FiLoader className="animate-spin h-5 w-5" />
          Loading...
        </span>
      ) : (
        <span className="flex items-center justify-center gap-2">
          {icon && iconPosition === "left" && icon}
          {children}
          {icon && iconPosition === "right" && icon}
        </span>
      )}
    </button>
  );
};

export default Button;
