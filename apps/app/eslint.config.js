/**
 * La regla que importa acá es import/no-restricted-paths: custodia las
 * capas del plan (domain ← data ← features) y en particular la regla A
 * ("toda escritura pasa por el repositorio") — si una pantalla importara
 * un driver o SQL directo, el outbox de fase 2 no capturaría sus escrituras.
 */
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";

export default tseslint.config(
  { ignores: ["dist", "src-tauri", "node_modules"] },
  ...tseslint.configs.recommended,
  {
    plugins: { import: importPlugin },
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/domain",
              from: ["./src/data", "./src/features", "./src/ui", "./src/lib"],
              message: "domain/ es puro: no importa de ninguna otra capa.",
            },
            {
              target: "./src/data",
              from: ["./src/features", "./src/ui", "./src/lib"],
              message: "data/ no conoce la UI.",
            },
            {
              target: ["./src/features", "./src/ui", "./src/lib"],
              from: "./src/data/drivers",
              except: ["./detect.ts"],
              message:
                "Los drivers solo se tocan desde el bootstrap (app-context vía detect). Las pantallas hablan con repositorios.",
            },
          ],
        },
      ],
    },
  },
);
