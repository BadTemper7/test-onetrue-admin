import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";

const VerifiedClientRoute = () => {
  const user = useAuthStore((state) => state.user);
  const canUseBookings = ["active", "verified"].includes(user?.status);

  return canUseBookings ? <Outlet /> : <Navigate to="/profile" replace />;
};

export default VerifiedClientRoute;
