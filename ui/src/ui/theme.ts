export const VALID_THEME_NAMES = ["core", "obsidian", "coredash"] as const;
export type ThemeName = (typeof VALID_THEME_NAMES)[number];

export function isValidThemeName(name: string): name is ThemeName {
  return VALID_THEME_NAMES.includes(name as ThemeName);
}

export const VALID_THEME_MODES = ["system", "light", "dark"] as const;
export type ThemeMode = (typeof VALID_THEME_MODES)[number];

export type ResolvedTheme =
  | "light"
  | "dark"
  | "obsidian"
  | "obsidian-light"
  | "coredash"
  | "coredash-light";
