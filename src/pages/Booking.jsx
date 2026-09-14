// pages/Booking.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiTruck,
  FiPackage,
  FiMapPin,
  FiCalendar,
  FiClock,
  FiUser,
  FiDollarSign,
  FiCheckCircle,
  FiAlertCircle,
  FiArrowLeft,
  FiArrowRight,
  FiCheck,
  FiBox,
  FiGrid,
  FiThermometer,
  FiAnchor,
  FiTruck as FiTruckIcon,
  FiFileText,
  FiInfo,
} from "react-icons/fi";
import Button from "../components/ui/Button";
import InputText from "../components/ui/InputText";
import InputDate from "../components/ui/InputDate";
import InputTime from "../components/ui/InputTime";
import Select from "../components/ui/Select";
import ModernFileInput from "../components/ModernFileInput";
import { useBookingStore } from "../stores/bookingStore";
import { getApiError } from "../lib/api";

const documentFields = [
  { name: "deliveryOrder", label: "Delivery Order", required: true },
  { name: "bookingConfirmation", label: "Booking Confirmation", required: false },
  { name: "packingList", label: "Packing List", required: false },
  { name: "customsClearance", label: "Customs Clearance", required: false },
  { name: "otherDocument", label: "Other Document", required: false },
];

const Booking = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const createBooking = useBookingStore((state) => state.createBooking);
  const loading = useBookingStore((state) => state.submitting);

  // Form Data
  const [formData, setFormData] = useState({
    // Container Details
    containerNumber: "",
    containerSize: "",
    containerType: "",
    loadStatus: "",
    rateType: "",
    scheduledDateIn: null,
    scheduledTimeIn: null,
    shippingLine: "",

    // Driver and Truck Details
    truckPlateNumber: "",
    driverName: "",
    driverLicenseNumber: "",
    hauler: "",
    blNumber: "",
    vesselVoyage: "",
    weight: "",
    cargoDescription: "",
    remarks: "",
  });

  const [errors, setErrors] = useState({});
  const [files, setFiles] = useState({});

  // Options

  const containerSizes = [
    { value: "20", label: "20 ft" },
    { value: "40", label: "40 ft" },
  ];

  const containerTypes = [
    { value: "dry", label: "Dry Container" },
    { value: "reefer", label: "Reefer (Refrigerated)" },
    { value: "tank", label: "Tank Container" },
    { value: "open_top", label: "Open Top" },
    { value: "flat_rack", label: "Flat Rack" },
  ];

  const loadStatuses = [
    { value: "empty", label: "Empty" },
    { value: "laden", label: "Laden (Loaded)" },
  ];

  const transactionClassifications = [
    { value: "local", label: "Local Transaction" },
    { value: "international", label: "International Transaction" },
  ];

  const validateField = (name, value = formData[name]) => {
    const textValue = typeof value === "string" ? value.trim() : value;

    const requiredMessages = {
      containerNumber: "Container number is required",
      containerSize: "Container size is required",
      containerType: "Container type is required",
      loadStatus: "Load status is required",
      rateType: "Transaction classification is required",
      scheduledDateIn: "Scheduled date in is required",
      scheduledTimeIn: "Scheduled time in is required",
      shippingLine: "Shipping line is required",
      truckPlateNumber: "Truck plate number is required",
      driverName: "Driver name is required",
      driverLicenseNumber: "Driver license number is required",
      hauler: "Hauler is required",
      weight: "Container weight is required",
    };

    if (requiredMessages[name] && !textValue) return requiredMessages[name];
    if (name === "weight" && textValue !== "" && Number(value) <= 0) return "Weight must be greater than zero";
    return "";
  };

  const validateFields = (fieldNames) => {
    const nextErrors = {};
    fieldNames.forEach((fieldName) => {
      const message = validateField(fieldName);
      if (message) nextErrors[fieldName] = message;
    });

    setErrors((current) => {
      const next = { ...current };
      fieldNames.forEach((fieldName) => delete next[fieldName]);
      return { ...next, ...nextErrors };
    });

    return Object.keys(nextErrors).length === 0;
  };

  const handleBlur = (event) => {
    const { name, value } = event.target;
    const message = validateField(name, value);
    setErrors((current) => ({ ...current, [name]: message }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleFileChange = (event) => {
    const { name, files: fileList } = event.target;
    const file = fileList?.[0] || null;
    setFiles((current) => ({ ...current, [name]: file }));
    setErrors((current) => ({
      ...current,
      [name]: "",
      documents: "",
    }));
  };

  const validateStep1 = () =>
    validateFields([
      "containerNumber",
      "containerSize",
      "containerType",
      "loadStatus",
      "rateType",
      "scheduledDateIn",
      "scheduledTimeIn",
      "shippingLine",
    ]);

  const validateStep2 = () =>
    validateFields([
      "truckPlateNumber",
      "driverName",
      "driverLicenseNumber",
      "hauler",
      "weight",
    ]);

  const validateStep3 = () => {
    const newErrors = {};
    if (!files.deliveryOrder) newErrors.deliveryOrder = "Delivery Order is required.";

    setErrors((current) => ({
      ...current,
      documents: Object.keys(newErrors).length ? "Please upload the required documents below." : "",
      ...newErrors,
    }));
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    let isValid = false;
    switch (currentStep) {
      case 1:
        isValid = validateStep1();
        break;
      case 2:
        isValid = validateStep2();
        break;
      case 3:
        isValid = validateStep3();
        break;
      default:
        isValid = true;
    }

    if (isValid) {
      if (currentStep === 3) {
        handleSubmit();
      } else {
        setCurrentStep((prev) => Math.min(prev + 1, 3));
      }
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const toArrivalDate = () => {
    const date = new Date(formData.scheduledDateIn);
    const time = new Date(formData.scheduledTimeIn);

    if (Number.isNaN(date.getTime())) return null;
    if (!Number.isNaN(time.getTime())) {
      date.setHours(time.getHours(), time.getMinutes(), 0, 0);
    }

    return date.toISOString();
  };

  const handleSubmit = async () => {
    setErrors({});

    try {
      const arrivalDate = toArrivalDate();
      const payload = new FormData();
      const bookingFields = {
        containerNumber: formData.containerNumber,
        containerSize: Number(formData.containerSize),
        containerType: formData.containerType,
        containerLoadStatus: formData.loadStatus,
        rateType: formData.rateType,
        shippingLine: formData.shippingLine,
        truckPlateNumber: formData.truckPlateNumber,
        driverName: formData.driverName,
        driverLicenseNumber: formData.driverLicenseNumber,
        hauler: formData.hauler,
        blNumber: formData.blNumber,
        vesselVoyage: formData.vesselVoyage,
        cargoDescription: formData.cargoDescription,
        weight: Number(formData.weight),
        expectedArrivalDate: arrivalDate,
        inDate: arrivalDate,
        clientRemarks: formData.remarks,
      };

      Object.entries(bookingFields).forEach(([key, value]) => {
        payload.append(key, value ?? "");
      });
      Object.entries(files).forEach(([key, file]) => {
        if (file) payload.append(key, file);
      });

      const { booking } = await createBooking(payload);

      setBookingId(booking?.bookingReference || booking?.id || "");
      setBookingSuccess(true);
      setCurrentStep(1);
      setFiles({});
      setFormData({
        containerNumber: "",
            containerSize: "",
        containerType: "",
        loadStatus: "",
        rateType: "",
        scheduledDateIn: null,
        scheduledTimeIn: null,
        shippingLine: "",
        truckPlateNumber: "",
        driverName: "",
        driverLicenseNumber: "",
        hauler: "",
        blNumber: "",
        vesselVoyage: "",
        weight: "",
        cargoDescription: "",
        remarks: "",
      });
    } catch (error) {
      const message = getApiError(error);
      const normalizedMessage = message.toLowerCase();
      const fieldMap = [
        ["container", "containerNumber", 1],
        ["in date", "scheduledDateIn", 1],
        ["arrival", "scheduledDateIn", 1],
        ["truck", "truckPlateNumber", 2],
        ["driver", "driverName", 2],
        ["hauler", "hauler", 2],
        ["delivery order", "deliveryOrder", 3],
        ["booking confirmation", "bookingConfirmation", 3],
      ];
      const matchedField = fieldMap.find(([keyword]) => normalizedMessage.includes(keyword));

      if (matchedField) {
        const [, fieldName, step] = matchedField;
        setCurrentStep(step);
        setErrors((current) => ({ ...current, [fieldName]: message, general: "" }));
      } else {
        setErrors((current) => ({ ...current, general: message }));
      }
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { number: 1, label: "Container Details" },
      { number: 2, label: "Driver & Truck" },
      { number: 3, label: "Documents" },
    ];

    return (
      <div className="mb-8">
        <div className="flex items-center justify-between relative">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className="flex flex-col items-center flex-1"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold relative z-10 transition-all duration-300 ${
                  currentStep === step.number
                    ? "bg-emerald-600 text-white ring-4 ring-emerald-200"
                    : currentStep > step.number
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-500"
                }`}
              >
                {currentStep > step.number ? (
                  <FiCheck className="w-5 h-5" />
                ) : (
                  step.number
                )}
              </div>
              <span
                className={`text-xs mt-2 font-medium ${
                  currentStep === step.number
                    ? "text-emerald-600"
                    : currentStep > step.number
                      ? "text-blue-500"
                      : "text-gray-400"
                }`}
              >
                {step.label}
              </span>
            </div>
          ))}
          <div className="absolute top-5 left-0 w-full h-0.5 -translate-y-1/2">
            <div className="h-full bg-gray-200">
              <div
                className="h-full bg-emerald-600 transition-all duration-500"
                style={{
                  width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800">
          Container Details
        </h3>
        <p className="text-sm text-gray-500">Enter the container information</p>
      </div>

      <InputText
        label="Container Number"
        name="containerNumber"
        value={formData.containerNumber}
        onChange={handleChange}
        onBlur={handleBlur}
        error={errors.containerNumber}
        placeholder="e.g., CONT-123456"
        required
        icon={<FiBox className="h-5 w-5 text-gray-400" />}
      />


      <Select
        label="Container Size"
        name="containerSize"
        value={formData.containerSize}
        onChange={handleChange}
        onBlur={handleBlur}
        error={errors.containerSize}
        options={containerSizes}
        placeholder="Select container size"
        required
        icon={<FiGrid className="h-5 w-5 text-gray-400" />}
      />

      <Select
        label="Container Type"
        name="containerType"
        value={formData.containerType}
        onChange={handleChange}
        onBlur={handleBlur}
        error={errors.containerType}
        options={containerTypes}
        placeholder="Select container type"
        required
        icon={<FiPackage className="h-5 w-5 text-gray-400" />}
      />

      <Select
        label="Load Status"
        name="loadStatus"
        value={formData.loadStatus}
        onChange={handleChange}
        onBlur={handleBlur}
        error={errors.loadStatus}
        options={loadStatuses}
        placeholder="Select load status"
        required
        icon={<FiPackage className="h-5 w-5 text-gray-400" />}
      />

      <div>
        <Select
          label="Transaction Classification"
          name="rateType"
          value={formData.rateType}
          onChange={handleChange}
          onBlur={handleBlur}
          error={errors.rateType}
          options={transactionClassifications}
          placeholder="Select Local or International"
          required
          icon={<FiAnchor className="h-5 w-5 text-gray-400" />}
        />
        <p className="mt-1 text-xs font-medium text-slate-500">
          Billing will automatically apply the Local or International rates selected for this container booking.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InputDate
          label="Scheduled Date In"
          name="scheduledDateIn"
          value={formData.scheduledDateIn}
          onChange={handleDateChange}
          onBlur={() => handleBlur({ target: { name: "scheduledDateIn", value: formData.scheduledDateIn } })}
          error={errors.scheduledDateIn}
          placeholder="Select date"
          required
          minDate={new Date()}
        />

        <InputTime
          label="Scheduled Time In"
          name="scheduledTimeIn"
          value={formData.scheduledTimeIn}
          onChange={handleDateChange}
          onBlur={() => handleBlur({ target: { name: "scheduledTimeIn", value: formData.scheduledTimeIn } })}
          error={errors.scheduledTimeIn}
          placeholder="Select time"
          required
          minuteStep={60}
          hourlyOnly
        />
      </div>

      <InputText
        label="Shipping Line"
        name="shippingLine"
        value={formData.shippingLine}
        onChange={handleChange}
        onBlur={handleBlur}
        error={errors.shippingLine}
        placeholder="Enter shipping line (e.g., Maersk, MSC, CMA CGM)"
        required
        icon={<FiAnchor className="h-5 w-5 text-gray-400" />}
      />
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800">
          Driver and Truck Details
        </h3>
        <p className="text-sm text-gray-500">
          Enter the driver and truck information
        </p>
      </div>

      <InputText
        label="Truck Plate Number"
        name="truckPlateNumber"
        value={formData.truckPlateNumber}
        onChange={handleChange}
        onBlur={handleBlur}
        error={errors.truckPlateNumber}
        placeholder="e.g., ABC-1234"
        required
        icon={<FiTruckIcon className="h-5 w-5 text-gray-400" />}
      />

      <InputText
        label="Driver Name"
        name="driverName"
        value={formData.driverName}
        onChange={handleChange}
        onBlur={handleBlur}
        error={errors.driverName}
        placeholder="Enter driver's full name"
        required
        icon={<FiUser className="h-5 w-5 text-gray-400" />}
      />

      <InputText
        label="Driver License Number"
        name="driverLicenseNumber"
        value={formData.driverLicenseNumber}
        onChange={handleChange}
        onBlur={handleBlur}
        error={errors.driverLicenseNumber}
        placeholder="Enter driver's license number"
        required
        icon={<FiFileText className="h-5 w-5 text-gray-400" />}
      />

      <InputText
        label="Hauler"
        name="hauler"
        value={formData.hauler}
        onChange={handleChange}
        onBlur={handleBlur}
        error={errors.hauler}
        placeholder="Enter hauler company or operator"
        required
        icon={<FiTruck className="h-5 w-5 text-gray-400" />}
      />

      <InputText
        label="BL Number"
        name="blNumber"
        value={formData.blNumber}
        onChange={handleChange}
        onBlur={handleBlur}
        error={errors.blNumber}
        placeholder="Optional BL number"
        icon={<FiFileText className="h-5 w-5 text-gray-400" />}
      />

      <InputText
        label="Vessel/Voyage"
        name="vesselVoyage"
        value={formData.vesselVoyage}
        onChange={handleChange}
        onBlur={handleBlur}
        error={errors.vesselVoyage}
        placeholder="Optional vessel / voyage"
        icon={<FiAnchor className="h-5 w-5 text-gray-400" />}
      />

      <InputText
        label="Weight (kg)"
        name="weight"
        type="number"
        value={formData.weight}
        onChange={handleChange}
        onBlur={handleBlur}
        error={errors.weight}
        placeholder="Enter container weight in kg"
        required
        icon={<FiDollarSign className="h-5 w-5 text-gray-400" />}
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Cargo Description
        </label>
        <textarea
          name="cargoDescription"
          value={formData.cargoDescription}
          onChange={handleChange}
          rows="3"
          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
          placeholder="Describe the cargo being transported..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Remarks
        </label>
        <textarea
          name="remarks"
          value={formData.remarks}
          onChange={handleChange}
          rows="2"
          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
          placeholder="Any additional remarks or special instructions..."
        />
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800">Pre-Advice Documents</h3>
        <p className="text-sm text-gray-500">Upload the documents that admin will verify together with this booking.</p>
      </div>

      {errors.documents && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {errors.documents}
        </div>
      )}

      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
        <p className="font-semibold">Delivery Order / Supporting Delivery Document</p>
        <p className="mt-1">Accepted examples: Equipment Interchange Receipt (EIR), Bill of Lading (B/L), Waybill, Delivery Receipt, Delivery Order, or other supporting delivery documents.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {documentFields.map((document) => (
          <ModernFileInput
            key={document.name}
            name={document.name}
            label={document.label}
            required={document.required}
            file={files[document.name]}
            onChange={handleFileChange}
            error={errors[document.name]}
            disabled={loading}
          />
        ))}
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
        After submission, this booking and its documents will appear in the admin Pre-Advice module for verification.
      </div>
    </div>
  );

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      default:
        return null;
    }
  };

  // Booking Flow Steps
  const bookingFlowSteps = [
    {
      icon: FiCheckCircle,
      title: "Create Booking",
      description: "Booking is automatically treated as pre-advice",
    },
    {
      icon: FiClock,
      title: "Pre-Advice Review",
      description: "Admin verifies the booking and assigns a yard area",
    },
    {
      icon: FiCheck,
      title: "Booking Approved",
      description: "Track status from Account → Bookings",
    },
    {
      icon: FiPackage,
      title: "Ready for Release",
      description: "Submit Date Out to compute final bill",
    },
    {
      icon: FiDollarSign,
      title: "Payment",
      description: "Add payment after final bill is shown",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
            Book Container
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Create a booking for pre-advice verification
          </p>
        </div>
      </div>

      {/* Booking Flow Guide */}
      <div className="bg-gradient-to-r from-emerald-50 to-blue-50 rounded-xl p-6 border border-emerald-100">
        <h3 className="text-sm font-semibold text-emerald-800 mb-3 flex items-center">
          <FiInfo className="h-4 w-4 mr-2" />
          Booking Flow
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {bookingFlowSteps.map((step, index) => (
            <div key={index} className="flex items-start space-x-2">
              <div className="flex-shrink-0 mt-0.5">
                <step.icon className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-700">
                  {step.title}
                </p>
                <p className="text-xs text-gray-500">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Booking Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {errors.general && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errors.general}
        </div>
      )}

      {bookingSuccess && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <FiCheckCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-700">
                  Booking Submitted for Pre-Advice Review!
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Booking ID:{" "}
                  <span className="font-mono font-semibold">{bookingId}</span>
                </p>
                <p className="text-xs text-blue-600">
                  Your booking is now visible in the admin Pre-Advice module for
                  verification and yard assignment. Track it from Account → Bookings.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step Indicator */}
        {!bookingSuccess && renderStepIndicator()}

        {/* Form Content */}
        <div className="mt-6">
          {!bookingSuccess ? (
            renderStep()
          ) : (
            <div className="text-center py-8">
              <FiCheckCircle className="h-16 w-16 text-blue-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                Booking Submitted!
              </h3>
              <p className="text-gray-600">
                Your booking was automatically submitted as pre-advice. You will
                be notified after the admin verifies it.
              </p>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        {!bookingSuccess && (
          <div className="mt-8 flex items-center justify-between space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1 || loading}
              icon={<FiArrowLeft className="h-4 w-4" />}
            >
              Back
            </Button>

            <Button
              type="button"
              variant="primary"
              onClick={handleNext}
              loading={loading}
              disabled={loading}
              icon={<FiArrowRight className="h-4 w-4" />}
              iconPosition="right"
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-200/50"
            >
              {currentStep === 3 ? "Submit Booking" : "Next"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Booking;
