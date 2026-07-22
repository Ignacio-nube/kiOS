/**
 * Temas de kiOS (Claro/Oscuro/Negro, como el selector de apariencia de X).
 * Es preferencia de ESTE dispositivo, no dato de negocio: por eso vive en
 * localStorage vía next-themes, no en la tabla `meta` sincronizable.
 */
export const THEME_STORAGE_KEY = "kios-theme";

export type ThemeId = "light" | "dark" | "black";

export const THEME_OPTIONS: {
  id: ThemeId;
  label: string;
  paper: string;
  surface: string;
  ink: string;
}[] = [
  { id: "light", label: "Claro", paper: "#faf9f7", surface: "#ffffff", ink: "#141413" },
  { id: "dark", label: "Oscuro", paper: "#1c1b19", surface: "#242320", ink: "#ededeb" },
  { id: "black", label: "Negro", paper: "#000000", surface: "#131211", ink: "#f5f3ee" },
];
