export const VALID_THEME_NAMES = ["claw", "knot", "dash"] as const;
export type ThemeName = (typeof VALID_THEME_NAMES)[number];

export const VALID_THEME_MODES = ["system", "light", "dark"] as const;
export type ThemeMode = (typeof VALID_THEME_MODES)[number];

export type ResolvedTheme = "light" | "dark" | "openknot" | "openknot-light" | "dash" | "dash-light";
