/**
 * Temas de kiOS (Claro/Oscuro/Negro + Sistema, como el selector de X).
 * Es preferencia de ESTE dispositivo, no dato de negocio: por eso vive en
 * localStorage vía next-themes, no en la tabla `meta` sincronizable.
 *
 * "Sistema" no es un tema de color propio: sigue prefers-color-scheme del SO
 * y resuelve a Claro u Oscuro (nunca Negro — Negro es una elección manual).
 */
export const THEME_STORAGE_KEY = "kios-theme";

export type ThemeId = "light" | "dark" | "black";
/** Lo que `setTheme` puede recibir: los concretos + el modo automático. */
export type ThemeChoice = ThemeId | "system";

/** Temas concretos con su preview de color (paper + surface + ink). */
export const THEME_OPTIONS: {
  id: ThemeId;
  label: string;
  paper: string;
  surface: string;
  ink: string;
}[] = [
  { id: "light", label: "Claro", paper: "#f2f2f7", surface: "#ffffff", ink: "#0b0b0c" },
  { id: "dark", label: "Oscuro", paper: "#0b0b0c", surface: "#1c1c1e", ink: "#f2f2f7" },
  { id: "black", label: "Negro", paper: "#000000", surface: "#121212", ink: "#f2f2f7" },
];
