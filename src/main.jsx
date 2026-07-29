import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import AuthBootstrap from "./components/auth/AuthBootstrap.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthBootstrap>
        <App />
      </AuthBootstrap>
    </BrowserRouter>
  </StrictMode>,
);
