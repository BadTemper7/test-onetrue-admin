import React, { useRef, useState } from "react";
import { FiUpload, FiX, FiFile, FiImage, FiAlertCircle } from "react-icons/fi";

const InputFile = ({
  label,
  name,
  onChange,
  accept = "image/*",
  multiple = false,
  required = false,
  disabled = false,
  error = "",
  className = "",
  labelClassName = "",
  maxSize = 5, // in MB
  preview = false,
  helperText = "",
  size = "md",
  ...props
}) => {
  const [fileName, setFileName] = useState("");
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  const sizes = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-3 text-base",
    lg: "px-5 py-4 text-lg",
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];

      // Validate file size
      if (file.size > maxSize * 1024 * 1024) {
        alert(`File size exceeds ${maxSize}MB limit`);
        e.target.value = "";
        return;
      }

      setFileName(file.name);

      // Generate preview
      if (preview && file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviewUrl(reader.result);
        };
        reader.readAsDataURL(file);
      }

      onChange(e);
    } else {
      setFileName("");
      setPreviewUrl(null);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const clearFile = (e) => {
    e.stopPropagation();
    setPreviewUrl(null);
    setFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    // Trigger change event with empty files
    const event = new Event("change", { bubbles: true });
    Object.defineProperty(event, "target", {
      value: { files: [], name },
    });
    onChange(event);
  };

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

      <div
        onClick={handleClick}
        className={`
          relative border-2 border-dashed rounded-lg 
          hover:border-yard-green transition-colors cursor-pointer
          ${sizes[size]}
          ${error ? "border-red-500 bg-red-50" : "border-gray-300"}
          ${disabled ? "opacity-60 cursor-not-allowed" : ""}
        `}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
      >
        <input
          ref={fileInputRef}
          id={name}
          name={name}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileChange}
          required={required}
          disabled={disabled}
          className="hidden"
          {...props}
        />

        <div className="flex flex-col items-center justify-center space-y-2">
          {previewUrl ? (
            <div className="relative w-full">
              <img
                src={previewUrl}
                alt="Preview"
                className="max-h-32 mx-auto object-contain rounded"
              />
              <button
                type="button"
                onClick={clearFile}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600 transition-colors"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <FiUpload
                className={`w-10 h-10 ${error ? "text-red-500" : "text-gray-400"}`}
              />
              <p
                className={`text-sm ${error ? "text-red-500" : "text-gray-500"}`}
              >
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-gray-400">
                {accept} (Max {maxSize}MB)
              </p>
            </>
          )}

          {fileName && !previewUrl && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              {fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <FiImage className="h-4 w-4" />
              ) : (
                <FiFile className="h-4 w-4" />
              )}
              <span className="truncate max-w-full">{fileName}</span>
            </div>
          )}
        </div>
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

export default InputFile;
