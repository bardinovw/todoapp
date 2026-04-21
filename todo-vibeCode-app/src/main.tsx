import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css"; // <-- ВОТ ЭТА ВОЛШЕБНАЯ СТРОЧКА!
import SmartTaskManager from "./SmartTaskManager.jsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SmartTaskManager />
  </StrictMode>,
);
