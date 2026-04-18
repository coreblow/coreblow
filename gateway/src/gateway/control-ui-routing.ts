/** CoreBlow — Control UI Routing */ export function resolveControlUiRoute(pathname: string): string { if (pathname === "/" || pathname === "") return "/index.html"; return pathname; }
