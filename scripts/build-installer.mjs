/**
 * Compila el instalador de escritorio y deja listo lo que hace falta para
 * publicarlo en Google Drive.
 *
 * Uso: npm run build:installer
 *
 * Además de compilar, imprime el SHA-256. No es ceremonia: el instalador
 * va a viajar por Drive sin firma de código, así que ese hash es la única
 * forma que tiene alguien de comprobar que lo que bajó es lo que vos
 * subiste. Conviene publicarlo al lado del link.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve, basename } from "node:path";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const R = (...p) => resolve(root, ...p);

const BUNDLE_DIR = R("apps/app/src-tauri/target/release/bundle/nsis");
const CONFIG = JSON.parse(readFileSync(R("apps/app/src-tauri/tauri.conf.json"), "utf8"));

console.log(`\n· Compilando kiOS ${CONFIG.version} para Windows…`);
console.log("  (la primera vez tarda varios minutos: compila todo Rust)\n");

execFileSync("npm", ["run", "tauri", "-w", "apps/app", "--", "build"], {
  cwd: root,
  stdio: "inherit",
  shell: true, // en Windows npm es npm.cmd
});

if (!existsSync(BUNDLE_DIR)) {
  throw new Error(`El build no dejó nada en ${BUNDLE_DIR}`);
}

// Puede haber instaladores de builds anteriores: se elige el más reciente.
const installers = readdirSync(BUNDLE_DIR)
  .filter((f) => f.endsWith(".exe"))
  .map((f) => ({ file: f, path: resolve(BUNDLE_DIR, f), mtime: statSync(resolve(BUNDLE_DIR, f)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);

if (installers.length === 0) {
  throw new Error(`No apareció ningún .exe en ${BUNDLE_DIR}`);
}

const { file, path } = installers[0];
const bytes = statSync(path).size;
const sha256 = createHash("sha256").update(readFileSync(path)).digest("hex");

console.log(`
╭─ Instalador listo ────────────────────────────────────────────────────

  Archivo   ${basename(file)}
  Tamaño    ${(bytes / 1024 / 1024).toFixed(1)} MB
  SHA-256   ${sha256}

  ${path}

╰───────────────────────────────────────────────────────────────────────

Para publicarlo en Google Drive:

  1. Subí el .exe y compartilo como "Cualquier persona con el enlace".

  2. Del link que te da Drive, copiá el ID (lo que va entre /d/ y /view):
       https://drive.google.com/file/d/ESTE_ES_EL_ID/view

  3. El botón de descarga necesita un enlace DIRECTO, no la vista previa
     de Drive. Armalo así y ponelo en VITE_DOWNLOAD_URL en Vercel:

       https://drive.usercontent.google.com/download?id=EL_ID&export=download

  4. Publicá el SHA-256 de arriba junto al link.

⚠ Este instalador NO está firmado. Windows SmartScreen va a mostrar
  "Windows protegió tu PC" y la mayoría de la gente cancela ahí. Para
  evitarlo hace falta un certificado de firma de código — está anotado
  como bloqueante en docs/LANZAMIENTO.md.
`);
