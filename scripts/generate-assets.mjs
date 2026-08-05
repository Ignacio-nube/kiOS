/**
 * Genera TODOS los assets del logo desde una única fuente: logo-kiOS.svg (raíz).
 *
 * Regla del proyecto: el SVG de la raíz es la ÚNICA copia editable a mano. Todo
 * lo demás (favicons, apple-touch, íconos de escritorio Tauri, el SVG embebido
 * en la app y la landing) es DERIVADO por este script. Si cambiás el logo,
 * reemplazás logo-kiOS.svg y corrés `npm run assets` — nada más se toca a mano.
 *
 * Uso: node scripts/generate-assets.mjs   (o `npm run assets`)
 *
 * Requiere: sharp (rasterizado SVG->PNG) y la CLI de Tauri (set de íconos de
 * escritorio). El .ico del navegador se reusa del que genera Tauri: es un .ico
 * multi-resolución correcto, así evitamos una dependencia extra solo para eso.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..");
const R = (...p) => resolve(root, ...p);

const SOURCE = R("logo-kiOS.svg");
const MASTER = R("scripts", ".master-1024.png"); // intermedio para `tauri icon`

// Destinos de las copias del SVG fuente (embebido en app y landing).
const SVG_COPIES = [
  R("apps/app/public/favicon.svg"),
  R("apps/app/src/assets/logo.svg"),
  R("apps/landing/public/favicon.svg"),
  R("apps/landing/public/logo.svg"),
];

// Favicons raster + apple-touch por app. `size` en px; 180 = apple-touch.
const RASTER_TARGETS = [
  { dir: R("apps/app/public"), sizes: [16, 32, 48, 180] },
  { dir: R("apps/landing/public"), sizes: [16, 32, 48, 180] },
];

const svg = readFileSync(SOURCE);

async function main() {
  console.log("· Fuente:", SOURCE);

  // 1) Copias del SVG (embebido en la app + hero de la landing).
  for (const dest of SVG_COPIES) {
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, svg);
  }
  console.log("· SVG copiado (%d destinos)", SVG_COPIES.length);

  // 2) Master 1024 RGBA para alimentar `tauri icon`. density alta = SVG nítido.
  await sharp(svg, { density: 384 })
    .resize(1024, 1024, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(MASTER);
  console.log("· Master 1024x1024 generado");

  // 3) Favicons raster + apple-touch-icon por app.
  for (const { dir, sizes } of RASTER_TARGETS) {
    for (const size of sizes) {
      const name = size === 180 ? "apple-touch-icon.png" : `favicon-${size}.png`;
      const out = resolve(dir, name);
      await sharp(svg, { density: 384 })
        .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(out);
    }
  }
  console.log("· Favicons PNG + apple-touch generados");

  // 4) Set completo de íconos de escritorio Tauri desde el master (una fuente).
  //    Genera icons/{32x32,128x128,128x128@2x,icon.ico,icon.icns,icon.png,Square*}.
  console.log("· Corriendo `tauri icon`…");
  execFileSync("npm", ["run", "tauri", "-w", "apps/app", "--", "icon", MASTER], {
    cwd: root,
    stdio: "inherit",
    shell: true, // en Windows npm es npm.cmd
  });

  // 5) Favicon .ico del navegador = el .ico multi-resolución que hizo Tauri.
  const tauriIco = R("apps/app/src-tauri/icons/icon.ico");
  copyFileSync(tauriIco, R("apps/app/public/favicon.ico"));
  copyFileSync(tauriIco, R("apps/landing/public/favicon.ico"));
  console.log("· favicon.ico copiado desde el set de Tauri");

  // 6) Limpieza del intermedio.
  rmSync(MASTER, { force: true });

  console.log("\n✓ Assets regenerados desde logo-kiOS.svg");
}

main().catch((err) => {
  console.error("✗ Falló la generación de assets:", err);
  process.exit(1);
});
