/**
 * Arma el sitio COMPLETO en `dist/` de la raíz: la landing en `/` y la
 * demo web en `/demo`.
 *
 * Existe para que todo se despliegue con UN solo proyecto de Vercel. La
 * alternativa era un proyecto por app (cada uno con su Root Directory),
 * que obliga a mantener dos configuraciones, dos juegos de variables de
 * entorno y dos dominios en sincronía.
 *
 * Las funciones de `api/` NO se tocan acá: Vercel las descubre solo, por
 * estar en `/api` de la raíz del repo, y las despliega como funciones
 * serverless. Este script arma únicamente lo estático.
 *
 * Uso: node scripts/build-vercel.mjs   (o `npm run build:vercel`)
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { cpSync, existsSync, rmSync } from "node:fs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const R = (...p) => resolve(root, ...p);

const OUT = R("dist");
const LANDING_DIST = R("apps/landing/dist");
const APP_DIST = R("apps/app/dist");

/** El demo vive bajo este prefijo. Cambiarlo acá lo cambia en todos lados. */
const DEMO_PATH = "demo";

function run(script, env) {
  console.log(`\n· ${script}`);
  execFileSync("npm", ["run", script], {
    cwd: root,
    stdio: "inherit",
    shell: true, // en Windows npm es npm.cmd
    env: { ...process.env, ...env },
  });
}

// Salida limpia: sin esto, un archivo borrado en el fuente sobrevive en
// `dist/` y se sigue publicando.
rmSync(OUT, { recursive: true, force: true });

// 1) Landing → raíz del sitio.
run("build:landing");
if (!existsSync(LANDING_DIST)) {
  throw new Error(`La landing no dejó nada en ${LANDING_DIST}`);
}
cpSync(LANDING_DIST, OUT, { recursive: true });

// 2) Demo web → /demo. `VITE_BASE_PATH` hace que sus assets se pidan con
//    el prefijo; sin eso el HTML buscaría en la raíz, donde está la landing.
run("build:web", { VITE_BASE_PATH: `/${DEMO_PATH}/` });
if (!existsSync(APP_DIST)) {
  throw new Error(`La app no dejó nada en ${APP_DIST}`);
}
cpSync(APP_DIST, resolve(OUT, DEMO_PATH), { recursive: true });

console.log(`\n✓ Sitio armado en dist/  ( / = landing, /${DEMO_PATH} = demo )`);
