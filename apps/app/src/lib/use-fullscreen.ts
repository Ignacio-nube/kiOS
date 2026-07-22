/**
 * Pantalla completa de TODA la app (mostrador sin distracciones de la
 * ventana). En Tauri se usa la ventana nativa (fullscreen real de SO); en
 * la demo web, la Fullscreen API del navegador.
 */
import { useCallback, useEffect, useState } from "react";
import { isTauri } from "../data/drivers/detect";

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (isTauri()) return; // el estado se sincroniza al togglear; no hay evento DOM confiable acá
    function onChange() {
      setIsFullscreen(document.fullscreenElement !== null);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = useCallback(async () => {
    try {
      if (isTauri()) {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();
        const next = !(await win.isFullscreen());
        await win.setFullscreen(next);
        setIsFullscreen(next);
        return;
      }
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // El navegador puede rechazar el pedido (sin gesto de usuario válido,
      // ventana ya en fullscreen del SO, etc.): no hay nada roto que arreglar.
    }
  }, []);

  return { isFullscreen, toggle };
}
