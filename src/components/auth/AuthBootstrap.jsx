import { useEffect } from "react";
import { useAuthStore } from "../../stores/authStore";

const AuthBootstrap = ({ children }) => {
  const refreshMe = useAuthStore((state) => state.refreshMe);

  useEffect(() => {
    // Revalidate cached sessions in the background only once on mount.
    // This must not disable the public login form while /auth/me is slow.
    void refreshMe();
  }, [refreshMe]);

  return children;
};

export default AuthBootstrap;
