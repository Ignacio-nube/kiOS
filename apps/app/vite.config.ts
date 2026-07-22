/// <reference types="vitest/config" />
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

/**
 * Los archivos de sqlite-wasm salen SIN hash: el worker1 crea un segundo
 * worker (el proxy OPFS) resolviendo "sqlite3-opfs-async-proxy.js"
 * relativo a sí mismo y Vite no reescribe esa referencia anidada. Si sale
 * hasheado → 404 silencioso → la demo cuelga en el spinner de arranque.
 */
function sqliteAwareAssetNames(assetInfo: { names: string[] }): string {
  const name = assetInfo.names[0] ?? "";
  return /^sqlite3(-opfs-async-proxy\.js|\.wasm)$/.test(name)
    ? "assets/[name][extname]"
    : "assets/[name]-[hash][extname]";
}

/**
 * Config compartida por los dos targets:
 * - `npm run tauri dev/build` → escritorio (Tauri inyecta sus globals).
 * - `npm run build:web` / `npm run dev` en navegador → demo con SQLite WASM.
 *
 * COOP/COEP: sin estos headers no hay SharedArrayBuffer y el VFS OPFS de
 * sqlite-wasm no arranca. No molestan al build de Tauri (sin HTTP real).
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // sqlite-wasm trae workers propios; pre-optimizarlo rompe rutas internas.
  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm"],
  },

  build: {
    rollupOptions: {
      output: { assetFileNames: sqliteAwareAssetNames },
    },
  },
  worker: {
    rollupOptions: {
      output: { assetFileNames: sqliteAwareAssetNames },
    },
  },

  // `npm test` corre unit (dominio) + integración (capa de datos) juntos.
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    benchmark: {
      include: ["tests/**/*.bench.ts"],
    },
  },

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
