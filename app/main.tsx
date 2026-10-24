import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App, resolveRoute } from "./routes";
import "./globals.css";

// set the theme before the first paint so pages never flash the wrong colours
if (resolveRoute(window.location.pathname).theme === "site") document.documentElement.dataset.theme = "site";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
