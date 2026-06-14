import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppPrefsProvider } from "./context/AppPrefsContext";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppPrefsProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppPrefsProvider>
  </StrictMode>,
);
