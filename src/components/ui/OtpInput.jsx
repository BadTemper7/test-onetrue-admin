// components/ui/OtpInput.jsx
import React, { useState, useRef, useEffect } from "react";
import { FiCheckCircle, FiAlertCircle } from "react-icons/fi";

const OtpInput = ({
  value = "",
  onChange,
  error,
  length = 6,
  disabled = false,
  autoFocus = true,
  onComplete,
  label,
  required = false,
  containerClassName = "",
}) => {
  const [otp, setOtp] = useState(Array(length).fill(""));
  const inputRefs = useRef([]);

  // Initialize OTP from value prop
  useEffect(() => {
    if (value) {
      const otpArray = value.split("").slice(0, length);
      const newOtp = Array(length).fill("");
      otpArray.forEach((char, index) => {
        newOtp[index] = char;
      });
      setOtp(newOtp);
    }
  }, [value, length]);

  // Auto-focus first input
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const handleChange = (index, e) => {
    const val = e.target.value;

    // Only allow single digit
    if (val && !/^\d$/.test(val)) return;

    const newOtp = [...otp];
    newOtp[index] = val;
    setOtp(newOtp);

    // Update parent form
    const otpValue = newOtp.join("");
    onChange({
      target: {
        name: "otp",
        value: otpValue,
      },
    });

    // Auto advance to next input
    if (val && index < length - 1) {
      inputRefs.current[index + 1].focus();
    }

    // Check if OTP is complete
    if (otpValue.length === length) {
      onComplete?.(otpValue);
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
        inputRefs.current[index - 1].focus();
      }
      const newOtp = [...otp];
      newOtp[index] = "";
      setOtp(newOtp);

      // Update parent form
      onChange({
        target: {
          name: "otp",
          value: newOtp.join(""),
        },
      });
    }

    // Handle left arrow
    if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1].focus();
    }

    // Handle right arrow
    if (e.key === "ArrowRight" && index < length - 1) {
      inputRefs.current[index + 1].focus();
    }

    // Handle paste
    if (e.key === "v" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      navigator.clipboard.readText().then((text) => {
        const digits = text.replace(/\D/g, "").slice(0, length);
        const newOtp = Array(length).fill("");
        digits.split("").forEach((char, idx) => {
          newOtp[idx] = char;
        });
        setOtp(newOtp);

        // Update parent form
        onChange({
          target: {
            name: "otp",
            value: newOtp.join(""),
          },
        });

        // Focus last filled or next empty
        const lastFilledIndex = newOtp.findIndex((val) => val === "");
        if (lastFilledIndex === -1) {
          inputRefs.current[length - 1].focus();
          onComplete?.(newOtp.join(""));
        } else {
          inputRefs.current[lastFilledIndex].focus();
        }
      });
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text");
    const digits = pastedData.replace(/\D/g, "").slice(0, length);

    if (digits) {
      const newOtp = Array(length).fill("");
      digits.split("").forEach((char, idx) => {
        newOtp[idx] = char;
      });
      setOtp(newOtp);

      // Update parent form
      onChange({
        target: {
          name: "otp",
          value: newOtp.join(""),
        },
      });

      // Focus last filled or next empty
      const lastFilledIndex = newOtp.findIndex((val) => val === "");
      if (lastFilledIndex === -1) {
        inputRefs.current[length - 1].focus();
        onComplete?.(newOtp.join(""));
      } else {
        inputRefs.current[lastFilledIndex].focus();
      }
    }
  };

  const handleFocus = (index) => {
    if (otp[index] && index < length - 1) {
      // If there's a value and user focuses, select all text
      inputRefs.current[index].select();
    }
  };

  const getInputClasses = (index) => {
    const baseClasses = `
      w-12 h-14 text-center text-xl font-semibold rounded-lg border-2 transition-all duration-200
      focus:outline-none focus:ring-2 focus:ring-opacity-50
      ${disabled ? "bg-gray-100 cursor-not-allowed opacity-70" : "bg-white"}
    `;

    if (error) {
      return `${baseClasses} border-red-300 focus:ring-red-500 focus:border-red-500 bg-red-50`;
    }

    if (otp[index]) {
      return `${baseClasses} border-emerald-400 focus:ring-emerald-500 focus:border-emerald-500 bg-emerald-50`;
    }

    return `${baseClasses} border-gray-300 focus:ring-emerald-500 focus:border-emerald-500 hover:border-emerald-300`;
  };

  return (
    <div className={`space-y-2 ${containerClassName}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="flex items-center justify-center gap-2 md:gap-3">
        {Array.from({ length }, (_, index) => (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={otp[index] || ""}
            onChange={(e) => handleChange(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            onFocus={() => handleFocus(index)}
            disabled={disabled}
            className={getInputClasses(index)}
            autoComplete="one-time-code"
            aria-label={`Digit ${index + 1} of ${length}`}
          />
        ))}
      </div>

      {error && (
        <div className="flex items-center space-x-1.5 text-red-500 text-sm mt-2">
          <FiAlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!error && value && value.length === length && (
        <div className="flex items-center space-x-1.5 text-blue-500 text-sm mt-2">
          <FiCheckCircle className="h-4 w-4 flex-shrink-0" />
          <span>OTP verified successfully</span>
        </div>
      )}
    </div>
  );
};

export default OtpInput;
