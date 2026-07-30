import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Fuente de títulos autoalojada: sin request a Google Fonts, sin FOUT por red.
import "@fontsource-variable/space-grotesk";
import "./style.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
