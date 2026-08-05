import { defineConfig } from "vitest/config";

/**
 * Tests de las funciones serverless de `api/` (checkout y webhook de
 * Mercado Pago). Viven en la raíz porque ahí las busca Vercel, así que su
 * corrida también es de raíz — la de la app sigue en `apps/app`.
 *
 * Solo se testea `api/`: es el código con plata en juego. La landing es
 * composición visual y se verifica mirándola, no con aserciones.
 */
export default defineConfig({
  test: {
    include: ["api/**/*.test.ts"],
    environment: "node",
  },
});
