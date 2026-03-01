import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { BrowserRouter, HashRouter } from "react-router-dom";
import "@/styles/theme.css";

const isElectron =
  typeof window !== "undefined" &&
  ("electronAPI" in window || !!(window as any).process?.versions?.electron);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isElectron ? (
      <HashRouter>
        <App />
      </HashRouter>
    ) : (
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )}
  </React.StrictMode>
);
