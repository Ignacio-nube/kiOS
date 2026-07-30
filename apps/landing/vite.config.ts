import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // Solo se testea `api/`: es el código con plata en juego (firma de
    // licencias, validación del webhook). Las secciones de la landing son
    // composición visual y se verifican mirándolas, no con aserciones.
    include: ["api/**/*.test.ts"],
    environment: "node",
  },
});
