import "./style.css";

/**
 * Todas las URLs entran por entorno (el dominio se compra después):
 * - VITE_DEMO_URL: la demo web (apps/app desplegada).
 * - VITE_DOWNLOAD_URL: instalador de escritorio (opcional por ahora).
 */
const demoUrl = import.meta.env.VITE_DEMO_URL as string | undefined;
const downloadUrl = import.meta.env.VITE_DOWNLOAD_URL as string | undefined;

for (const id of ["cta-demo", "cta-demo-top"]) {
  const link = document.getElementById(id) as HTMLAnchorElement | null;
  if (!link) continue;
  if (demoUrl) {
    link.href = demoUrl;
  } else {
    link.ariaDisabled = "true";
    link.classList.add("pointer-events-none", "opacity-50");
    link.title = "Demo todavía no publicada";
  }
}

const download = document.getElementById("cta-download") as HTMLAnchorElement | null;
if (download && downloadUrl) {
  download.href = downloadUrl;
  download.classList.remove("hidden");
}
