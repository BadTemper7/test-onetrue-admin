import { useEffect } from "react";
import { useAuthStore } from "../../stores/authStore";

const AuthBootstrap = ({ children }) => {
  const initialized = useAuthStore((state) => state.initialized);
  const refreshMe = useAuthStore((state) => state.refreshMe);

  useEffect(() => {
    if (!initialized) refreshMe();
  }, [initialized, refreshMe]);

  return children;
};

export default AuthBootstrap;
