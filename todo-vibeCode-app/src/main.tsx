import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

// @ts-ignore
import SmartTaskManager from "./SmartTaskManager";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SmartTaskManager />
  </StrictMode>,
);
