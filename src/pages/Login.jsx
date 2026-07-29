import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiMail,
  FiLock,
  FiEye,
  FiEyeOff,
  FiLogIn,
  FiAlertCircle,
  FiShield,
  FiTrendingUp,
  FiUsers,
  FiBarChart2,
} from "react-icons/fi";
import InputText from "../components/ui/InputText";
import Button from "../components/ui/Button";
import CheckBox from "../components/ui/CheckBox";
import logo from "../assets/logo.png";
import { useAuthStore } from "../stores/authStore";
import { getApiError } from "../lib/api";

const Login = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const loading = useAuthStore((state) => state.loading);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setErrors({});

    try {
      await login({
        email: formData.email.trim(),
        password: formData.password,
        loginType: "admin",
      });
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setErrors({ general: getApiError(error) });
    }
  };

  const stats = [
    {
      icon: FiUsers,
      value: "10K+",
      label: "Active Users",
      color: "text-yard-green",
    },
    {
      icon: FiBarChart2,
      value: "85%",
      label: "Satisfaction",
      color: "text-slate-500",
    },
    {
      icon: FiTrendingUp,
      value: "24/7",
      label: "Uptime",
      color: "text-slate-500",
    },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left Section - Light Gradient */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-yard-fog via-emerald-50 to-slate-100 flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Decorative Light Circles */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-300/25 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-slate-300/25 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
          <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-slate-300/25 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
        </div>

        <div className="relative z-10 text-center max-w-lg w-full">
          {/* Large Logo */}
          <div className="mb-6 flex justify-center">
            <div className="w-64 h-64 bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl shadow-emerald-200/40 border border-white/50 flex items-center justify-center">
              <img
                src={logo}
                alt="Admin Logo"
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          <h1 className="text-4xl font-bold text-yard-navy mb-2">
            Admin Dashboard
          </h1>
          <p className="text-slate-600 text-lg mb-8">
            Complete control over your application
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {stats.map((stat, index) => (
              <div
                key={index}
                className="bg-white/60 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-white/50 hover:shadow-md transition-shadow"
              >
                <stat.icon className={`h-6 w-6 ${stat.color} mx-auto mb-2`} />
                <div className="text-yard-navy font-bold text-xl">
                  {stat.value}
                </div>
                <div className="text-slate-500 text-xs">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Features */}
          <div className="space-y-3 text-left">
            <div className="flex items-center space-x-3 bg-white/60 backdrop-blur-sm rounded-lg p-3 border border-emerald-200 hover:border-yard-green/50 transition-all duration-200">
              <span className="text-xl">🔒</span>
              <span className="text-sm text-gray-700">
                Enterprise-grade security
              </span>
            </div>
            <div className="flex items-center space-x-3 bg-white/60 backdrop-blur-sm rounded-lg p-3 border border-slate-200 hover:border-yard-navy/30 transition-all duration-200">
              <span className="text-xl">📊</span>
              <span className="text-sm text-gray-700">
                Real-time analytics & reports
              </span>
            </div>
            <div className="flex items-center space-x-3 bg-white/60 backdrop-blur-sm rounded-lg p-3 border border-slate-200 hover:border-yard-navy/30 transition-all duration-200">
              <span className="text-xl">💬</span>
              <span className="text-sm text-gray-700">
                24/7 dedicated support
              </span>
            </div>
          </div>

          <div className="mt-8 text-slate-400 text-xs">
            <p>Secure • Reliable • Fast</p>
          </div>
        </div>
      </div>

      {/* Right Section - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-8 bg-gradient-to-br from-white to-yard-fog">
        <div className="w-full max-w-md bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl shadow-gray-200/50 p-8 space-y-6 border border-white/50">
          {/* Mobile Logo - Large */}
          <div className="lg:hidden flex flex-col items-center">
            <div className="w-32 h-32 mb-4 bg-gradient-to-br from-yard-fog via-emerald-50 to-slate-100 rounded-2xl p-4 shadow-lg shadow-emerald-200/40 flex items-center justify-center">
              <img
                src={logo}
                alt="Admin Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <h2 className="text-2xl font-bold text-yard-navy">Admin Panel</h2>
          </div>

          {/* Welcome */}
          <div>
            <h2 className="text-2xl font-bold text-yard-navy">Welcome Back</h2>
            <p className="text-slate-500 text-sm mt-1">
              Enter your credentials to access the admin panel
            </p>
          </div>

          {/* Error */}
          {errors.general && (
            <div className="bg-red-50 border border-red-200 p-3 rounded-lg flex items-start space-x-2">
              <FiAlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{errors.general}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <InputText
              label="Email Address"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              error={errors.email}
              placeholder="Enter your email"
              required
              disabled={loading}
              icon={<FiMail className="h-5 w-5 text-slate-400" />}
            />

            <InputText
              label="Password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={handleChange}
              error={errors.password}
              placeholder="Enter your password"
              required
              disabled={loading}
              icon={<FiLock className="h-5 w-5 text-slate-400" />}
              showPasswordToggle
              onTogglePassword={() => setShowPassword(!showPassword)}
            />

            <div className="flex items-center justify-between">
              <CheckBox
                label="Remember me"
                name="rememberMe"
                checked={formData.rememberMe}
                onChange={handleChange}
                size="sm"
              />
              <a
                href="#"
                className="text-sm text-yard-green hover:text-emerald-700 font-medium transition-colors"
              >
                Forgot password?
              </a>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              disabled={loading}
              icon={<FiLogIn className="h-5 w-5" />}
              className="bg-yard-green hover:bg-emerald-700 shadow-lg shadow-emerald-200/50"
            >
              Sign In
            </Button>
          </form>

          <p className="text-center text-xs text-slate-400">
            © 2024 Admin Panel. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
