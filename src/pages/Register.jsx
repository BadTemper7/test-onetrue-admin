// pages/Register.jsx (Fixed with equal 1/2 sections)
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  FiArrowLeft,
  FiArrowRight,
  FiCheck,
  FiHome,
  FiMapPin,
  FiUser,
  FiMail,
  FiLock,
  FiShield,
  FiFile,
  FiUpload,
  FiGlobe,
  FiBriefcase,
  FiUsers,
  FiTruck,
  FiPackage,
} from "react-icons/fi";
import InputText from "../components/ui/InputText";
import Button from "../components/ui/Button";
import Select from "../components/ui/Select";
import OtpInput from "../components/ui/OtpInput";
import logo from "../assets/logo.png";
import { api, getApiError } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { PRIVACY_POLICY_VERSION, TERMS_VERSION } from "../constants/legal";

const Register = () => {
  const navigate = useNavigate();
  const saveSession = useAuthStore((state) => state.saveSession);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Form Data
  const [formData, setFormData] = useState({
    // Step 1: Company Details
    companyName: "",
    companyAddress: "",
    companyType: "",
    otherCompanyType: "",

    // Step 2: Representative
    firstName: "",
    middleName: "",
    lastName: "",
    suffix: "",
    position: "",
    phoneNumber: "",

    // Step 3: Login Details
    email: "",
    password: "",
    confirmPassword: "",
    termsAccepted: false,
    privacyAccepted: false,
    representativeAuthorityConfirmed: false,

    // Step 4: OTP
    otp: "",

    // Step 5: Documents
    businessPermit: null,
    birCertificate: null,
    validId: null,
    authorizationLetter: null,
    otherDocument: null,
  });

  const [errors, setErrors] = useState({});

  const companyTypes = [
    { value: "trucking", label: "Trucking" },
    { value: "shipping", label: "Shipping" },
    { value: "brokerage", label: "Brokerage" },
    { value: "forwarder", label: "Forwarder" },
    { value: "other", label: "Other" },
  ];

  const positions = [
    { value: "owner", label: "Owner" },
    { value: "ceo", label: "CEO" },
    { value: "manager", label: "Manager" },
    { value: "supervisor", label: "Supervisor" },
    { value: "representative", label: "Representative" },
    { value: "other", label: "Other" },
  ];

  const suffixes = [
    { value: "", label: "None" },
    { value: "jr", label: "Jr." },
    { value: "sr", label: "Sr." },
    { value: "ii", label: "II" },
    { value: "iii", label: "III" },
    { value: "iv", label: "IV" },
  ];

  const features = [
    {
      icon: FiTruck,
      title: "Track Shipments",
      description: "Real-time tracking of all your shipments",
    },
    {
      icon: FiPackage,
      title: "Manage Orders",
      description: "Easily manage and process your orders",
    },
    {
      icon: FiGlobe,
      title: "Global Network",
      description: "Access to worldwide shipping networks",
    },
  ];

  const handleChange = (e) => {
    const { name, value, type, files, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "file" ? files[0] : type === "checkbox" ? checked : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateStep1 = () => {
    const newErrors = {};
    if (!formData.companyName.trim()) {
      newErrors.companyName = "Company name is required";
    }
    if (!formData.companyAddress.trim()) {
      newErrors.companyAddress = "Company address is required";
    }
    if (!formData.companyType) {
      newErrors.companyType = "Company type is required";
    }
    if (formData.companyType === "other" && !formData.otherCompanyType.trim()) {
      newErrors.otherCompanyType = "Please specify company type";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};
    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }
    if (!formData.position) {
      newErrors.position = "Position is required";
    }
    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = "Phone number is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = () => {
    const newErrors = {};
    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }
    if (!formData.termsAccepted) {
      newErrors.termsAccepted = "You must agree to the Terms and Conditions";
    }
    if (!formData.privacyAccepted) {
      newErrors.privacyAccepted = "You must consent to the Privacy Policy";
    }
    if (!formData.representativeAuthorityConfirmed) {
      newErrors.representativeAuthorityConfirmed =
        "You must confirm your authority and the accuracy of the information";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep4 = () => {
    const newErrors = {};
    if (!formData.otp || formData.otp.length !== 6) {
      newErrors.otp = "Please enter a valid 6-digit OTP";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep5 = () => {
    const newErrors = {};
    if (!formData.businessPermit) {
      newErrors.businessPermit = "Business permit is required";
    }
    if (!formData.birCertificate) {
      newErrors.birCertificate = "BIR Certificate is required";
    }
    if (!formData.validId) {
      newErrors.validId = "Valid ID is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const buildRegistrationFormData = () => {
    const payload = new FormData();
    const representativeLastName = [formData.lastName, formData.suffix]
      .filter(Boolean)
      .join(" ")
      .trim();

    const fields = {
      companyName: formData.companyName,
      companyAddress: formData.companyAddress,
      companyType: formData.companyType,
      companyTypeOther: formData.otherCompanyType,
      phoneNumber: formData.phoneNumber,
      representativeFirstName: formData.firstName,
      representativeMiddleName: formData.middleName,
      representativeLastName,
      representativePosition: formData.position,
      email: formData.email.trim(),
      password: formData.password,
      confirmPassword: formData.confirmPassword,
      termsAccepted: String(formData.termsAccepted),
      privacyAccepted: String(formData.privacyAccepted),
      representativeAuthorityConfirmed: String(
        formData.representativeAuthorityConfirmed,
      ),
      termsVersion: TERMS_VERSION,
      privacyPolicyVersion: PRIVACY_POLICY_VERSION,
    };

    Object.entries(fields).forEach(([key, value]) => {
      payload.append(key, value || "");
    });

    [
      "businessPermit",
      "birCertificate",
      "validId",
      "authorizationLetter",
      "otherDocument",
    ].forEach((fieldName) => {
      if (formData[fieldName]) payload.append(fieldName, formData[fieldName]);
    });

    return payload;
  };

  const handleNext = async () => {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;
    if (currentStep === 3 && !validateStep3()) return;

    if (currentStep === 4) {
      if (!validateStep5()) return;
      await sendOTP();
      return;
    }

    if (currentStep === 5) {
      if (!validateStep4()) return;
      await verifyOTP();
      return;
    }

    setCurrentStep((prev) => Math.min(prev + 1, 5));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const sendOTP = async () => {
    setLoading(true);
    setErrors({});

    try {
      const { data } = await api.post(
        "/auth/client/register/request-otp",
        buildRegistrationFormData(),
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      setOtpSent(true);
      setCurrentStep(5);
      return data;
    } catch (error) {
      setErrors({ general: getApiError(error) });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (otpVerified || isVerifying) return;

    if (!formData.otp || formData.otp.length !== 6) {
      setErrors({ otp: "Please enter a valid 6-digit OTP" });
      return;
    }

    setIsVerifying(true);
    setLoading(true);
    setErrors({});

    try {
      const { data } = await api.post("/auth/client/register/verify-otp", {
        email: formData.email.trim(),
        otp: formData.otp,
      });
      setOtpVerified(true);
      saveSession({ token: data.token, user: data.user });
      navigate(
        ["active", "verified"].includes(data.user?.status) ? "/" : "/profile",
        { replace: true },
      );
    } catch (error) {
      setErrors({ otp: getApiError(error) });
      setFormData((prev) => ({ ...prev, otp: "" }));
    } finally {
      setLoading(false);
      setIsVerifying(false);
    }
  };

  const handleOtpComplete = (otpValue) => {
    setFormData((prev) => ({ ...prev, otp: otpValue }));
    if (errors.otp) setErrors((prev) => ({ ...prev, otp: "" }));
  };

  const handleResendOTP = async () => {
    setLoading(true);
    setErrors({});
    try {
      await api.post("/auth/client/register/resend-otp", {
        email: formData.email.trim(),
      });
      setOtpSent(true);
      setFormData((prev) => ({ ...prev, otp: "" }));
    } catch (error) {
      setErrors({ otp: getApiError(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = verifyOTP;

  const renderStepIndicator = () => {
    const steps = [
      { number: 1, label: "Company" },
      { number: 2, label: "Representative" },
      { number: 3, label: "Login" },
      { number: 4, label: "Documents" },
      { number: 5, label: "OTP" },
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
        <h3 className="text-lg font-semibold text-gray-800">Company Details</h3>
        <p className="text-sm text-gray-500">Enter your company information</p>
      </div>

      <InputText
        label="Company Name"
        name="companyName"
        value={formData.companyName}
        onChange={handleChange}
        error={errors.companyName}
        placeholder="Enter company name"
        required
        icon={<FiHome className="h-5 w-5 text-gray-400" />}
      />

      <InputText
        label="Company Address"
        name="companyAddress"
        value={formData.companyAddress}
        onChange={handleChange}
        error={errors.companyAddress}
        placeholder="Enter company address"
        required
        icon={<FiMapPin className="h-5 w-5 text-gray-400" />}
      />

      <Select
        label="Business Type"
        name="companyType"
        value={formData.companyType}
        onChange={handleChange}
        error={errors.companyType}
        options={companyTypes}
        placeholder="Select company type"
        required
        icon={<FiBriefcase className="h-5 w-5 text-gray-400" />}
      />

      {formData.companyType === "other" && (
        <InputText
          label="Specify Company Type"
          name="otherCompanyType"
          value={formData.otherCompanyType}
          onChange={handleChange}
          error={errors.otherCompanyType}
          placeholder="Enter company type"
          required
        />
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800">Representative</h3>
        <p className="text-sm text-gray-500">
          Enter the representative's details
        </p>
      </div>

      <InputText
        label="First Name"
        name="firstName"
        value={formData.firstName}
        onChange={handleChange}
        error={errors.firstName}
        placeholder="Enter first name"
        required
        icon={<FiUser className="h-5 w-5 text-gray-400" />}
      />

      <InputText
        label="Middle Name"
        name="middleName"
        value={formData.middleName}
        onChange={handleChange}
        placeholder="Enter middle name (optional)"
        icon={<FiUser className="h-5 w-5 text-gray-400" />}
      />

      <InputText
        label="Last Name"
        name="lastName"
        value={formData.lastName}
        onChange={handleChange}
        error={errors.lastName}
        placeholder="Enter last name"
        required
        icon={<FiUser className="h-5 w-5 text-gray-400" />}
      />

      <Select
        label="Suffix"
        name="suffix"
        value={formData.suffix}
        onChange={handleChange}
        options={suffixes}
        placeholder="Select suffix (optional)"
      />

      <InputText
        label="Phone Number"
        name="phoneNumber"
        value={formData.phoneNumber}
        onChange={handleChange}
        error={errors.phoneNumber}
        placeholder="Enter phone number"
        required
        icon={<FiUser className="h-5 w-5 text-gray-400" />}
      />

      <Select
        label="Position"
        name="position"
        value={formData.position}
        onChange={handleChange}
        error={errors.position}
        options={positions}
        placeholder="Select position"
        required
        icon={<FiUsers className="h-5 w-5 text-gray-400" />}
      />
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800">Login Details</h3>
        <p className="text-sm text-gray-500">Create your account credentials</p>
      </div>

      <InputText
        label="Email Address"
        name="email"
        type="email"
        value={formData.email}
        onChange={handleChange}
        error={errors.email}
        placeholder="Enter email address"
        required
        icon={<FiMail className="h-5 w-5 text-gray-400" />}
      />

      <InputText
        label="Password"
        name="password"
        type={showPassword ? "text" : "password"}
        value={formData.password}
        onChange={handleChange}
        error={errors.password}
        placeholder="Enter password (min 8 characters)"
        required
        icon={<FiLock className="h-5 w-5 text-gray-400" />}
        showPasswordToggle
        onTogglePassword={() => setShowPassword(!showPassword)}
      />

      <InputText
        label="Confirm Password"
        name="confirmPassword"
        type={showConfirmPassword ? "text" : "password"}
        value={formData.confirmPassword}
        onChange={handleChange}
        error={errors.confirmPassword}
        placeholder="Confirm your password"
        required
        icon={<FiShield className="h-5 w-5 text-gray-400" />}
        showPasswordToggle
        onTogglePassword={() => setShowConfirmPassword(!showConfirmPassword)}
      />

      <div className="mt-6 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start gap-3">
          <FiShield className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-slate-800">
              Required legal agreements
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Your acceptance is recorded with the policy version, date, IP
              address, and browser information.
            </p>
          </div>
        </div>

        <LegalAgreementCheckbox
          name="termsAccepted"
          checked={formData.termsAccepted}
          onChange={handleChange}
          error={errors.termsAccepted}
        >
          I have read and agree to the{" "}
          <Link
            to="/terms-and-conditions"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="font-semibold text-emerald-700 hover:underline"
          >
            Terms and Conditions
          </Link>
          .
        </LegalAgreementCheckbox>

        <LegalAgreementCheckbox
          name="privacyAccepted"
          checked={formData.privacyAccepted}
          onChange={handleChange}
          error={errors.privacyAccepted}
        >
          I have read the{" "}
          <Link
            to="/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="font-semibold text-emerald-700 hover:underline"
          >
            Privacy Policy
          </Link>{" "}
          and consent to the processing and storage of my personal data and
          uploaded documents for registration and logistics services.
        </LegalAgreementCheckbox>

        <LegalAgreementCheckbox
          name="representativeAuthorityConfirmed"
          checked={formData.representativeAuthorityConfirmed}
          onChange={handleChange}
          error={errors.representativeAuthorityConfirmed}
        >
          I confirm that I am at least 18 years old, authorized to register this
          company, and that the information and documents I submit are accurate
          and lawfully provided.
        </LegalAgreementCheckbox>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800">Verify OTP</h3>
        <p className="text-sm text-gray-500">
          We sent a verification code to {formData.email}
        </p>
      </div>

      <div
        className={`border rounded-lg p-4 flex items-start space-x-3 ${
          otpVerified
            ? "bg-blue-50 border-blue-200"
            : errors.otp
              ? "bg-red-50 border-red-200"
              : "bg-blue-50 border-blue-200"
        }`}
      >
        <FiShield
          className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
            otpVerified
              ? "text-blue-500"
              : errors.otp
                ? "text-red-500"
                : "text-blue-500"
          }`}
        />
        <div className="text-sm">
          {otpVerified ? (
            <p className="text-blue-700 font-medium">
              ✓ OTP verified successfully!
            </p>
          ) : errors.otp ? (
            <p className="text-red-700">{errors.otp}</p>
          ) : (
            <div className="text-blue-700">
              <p>Enter the 6-digit code sent to your email.</p>
              {!otpSent && (
                <p className="text-xs mt-1">
                  Click "Send OTP" to receive the code.
                </p>
              )}
              {otpSent && !otpVerified && (
                <p className="text-xs mt-1 font-medium">
                  Code sent! Please check your email.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <OtpInput
        value={formData.otp}
        onChange={handleChange}
        error={errors.otp}
        length={6}
        disabled={loading || otpVerified}
        onComplete={handleOtpComplete}
        label="Enter OTP"
        required
        containerClassName="py-4"
      />

      {otpSent && !otpVerified && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleResendOTP}
            disabled={loading}
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Resend OTP
          </button>
          <span className="text-xs text-gray-400">
            Didn't receive the code?
          </span>
        </div>
      )}

      {otpVerified && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
          <p className="text-sm text-blue-700 font-medium">
            ✓ OTP verified. Completing registration...
          </p>
        </div>
      )}
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-4">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800">
          Upload Documents
        </h3>
        <p className="text-sm text-gray-500">
          Please upload the required documents for verification
        </p>
      </div>

      <div className="space-y-4">
        <FileUpload
          label="Business Permit"
          name="businessPermit"
          onChange={handleChange}
          error={errors.businessPermit}
          required
          icon={<FiFile className="h-5 w-5" />}
        />

        <FileUpload
          label="BIR Certificate"
          name="birCertificate"
          onChange={handleChange}
          error={errors.birCertificate}
          required
          icon={<FiFile className="h-5 w-5" />}
        />

        <FileUpload
          label="Valid ID"
          name="validId"
          onChange={handleChange}
          error={errors.validId}
          required
          icon={<FiFile className="h-5 w-5" />}
        />

        <FileUpload
          label="Authorization Letter"
          name="authorizationLetter"
          onChange={handleChange}
          icon={<FiFile className="h-5 w-5" />}
        />

        <FileUpload
          label="Other Document"
          name="otherDocument"
          onChange={handleChange}
          icon={<FiFile className="h-5 w-5" />}
        />
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
      case 4:
        return renderStep5();
      case 5:
        return renderStep4();
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Section - Client Branding - 1/2 width */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-50 via-emerald-50 to-purple-50 flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
          <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-emerald-200/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
        </div>

        <div className="relative z-10 text-center max-w-md w-full">
          <div className="w-48 h-48 mx-auto mb-6 bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl shadow-blue-200/30 border border-white/50 flex items-center justify-center">
            <img
              src={logo}
              alt="Logo"
              className="w-full h-full object-contain"
            />
          </div>

          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Create Account
          </h1>
          <p className="text-gray-600 text-sm mb-8">
            Join our platform and start managing your shipments
          </p>

          <div className="space-y-3">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-center space-x-4 bg-white/60 backdrop-blur-sm rounded-lg p-3 border border-white/50 hover:shadow-md transition-all duration-200"
              >
                <div className="text-emerald-500 flex-shrink-0">
                  <feature.icon className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-800">
                    {feature.title}
                  </p>
                  <p className="text-xs text-gray-600">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-gray-400 text-xs">
            <p>Secure • Reliable • Fast</p>
          </div>
        </div>
      </div>

      {/* Right Section - Registration Form - 1/2 width */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-8 bg-gradient-to-br from-white to-gray-50/80">
        <div className="w-full max-w-2xl bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl shadow-gray-200/50 p-8 border border-white/50">
          {/* Mobile Header */}
          <div className="lg:hidden flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <img src={logo} alt="Logo" className="w-10 h-10 object-contain" />
              <h2 className="text-xl font-bold text-gray-800">Register</h2>
            </div>
            <Link
              to="/login"
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Sign In
            </Link>
          </div>

          {/* Desktop Header */}
          <div className="hidden lg:flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Registration</h2>
              <p className="text-sm text-gray-500">
                Complete all steps to create your account
              </p>
            </div>
            <Link
              to="/login"
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Already have an account? Sign In
            </Link>
          </div>

          {/* Step Indicator */}
          {renderStepIndicator()}

          {errors.general && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errors.general}
            </div>
          )}

          {/* Form Content */}
          <div className="mt-6">{renderStep()}</div>

          {/* Navigation Buttons */}
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
              onClick={currentStep === 5 ? handleSubmit : handleNext}
              loading={loading}
              disabled={loading}
              icon={
                currentStep === 5 ? (
                  <FiCheck className="h-5 w-5" />
                ) : (
                  <FiArrowRight className="h-4 w-4" />
                )
              }
              iconPosition="right"
              className={
                currentStep === 5
                  ? "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-200/50"
                  : "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-200/50"
              }
            >
              {currentStep === 4
                ? "Upload and Send OTP"
                : currentStep === 5
                  ? "Verify and Submit"
                  : "Next"}
            </Button>
          </div>

          <div className="mt-4 text-center text-xs text-gray-400">
            <p>
              © {new Date().getFullYear()} One True Logistics Inc. All rights
              reserved.
            </p>
            <div className="mt-2 flex items-center justify-center gap-3">
              <Link
                to="/terms-and-conditions"
                className="hover:text-emerald-600 hover:underline"
              >
                Terms
              </Link>
              <span>•</span>
              <Link
                to="/privacy-policy"
                className="hover:text-emerald-600 hover:underline"
              >
                Privacy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const LegalAgreementCheckbox = ({
  name,
  checked,
  onChange,
  error,
  children,
}) => (
  <div>
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border bg-white p-3 transition ${error ? "border-red-300" : "border-slate-200 hover:border-emerald-300"}`}
    >
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
      />
      <span className="text-xs leading-5 text-slate-600">{children}</span>
    </label>
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </div>
);

// File Upload Component
const FileUpload = ({ label, name, onChange, error, required, icon, maxSize = 10 }) => {
  const [fileName, setFileName] = useState("");

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > maxSize * 1024 * 1024) {
        e.target.value = "";
        setFileName("");
        window.alert(`File size exceeds the ${maxSize} MB maximum upload size.`);
        return;
      }
      setFileName(file.name);
      onChange(e);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          type="file"
          name={name}
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          required={required}
        />
        <div className="flex items-center justify-center w-full p-4 border-2 border-dashed rounded-lg transition-colors bg-gray-50 hover:bg-gray-100 border-gray-300 hover:border-emerald-400">
          <div className="flex items-center space-x-3">
            {icon}
            <span className="text-sm text-gray-600">
              {fileName || `Upload ${label}`}
            </span>
            <FiUpload className="h-4 w-4 text-gray-400" />
          </div>
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-500">Maximum file size: {maxSize} MB</p>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
};

export default Register;
