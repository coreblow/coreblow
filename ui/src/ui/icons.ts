import { html, svg } from "lit";

export type IconName =
  | "messageSquare"
  | "barChart"
  | "link"
  | "radio"
  | "fileText"
  | "loader"
  | "zap"
  | "monitor"
  | "settings"
  | "send"
  | "spark"
  | "terminal"
  | "globe"
  | "brain"
  | "bug"
  | "scrollText"
  | "folder"
  | "eye"
  | "eyeOff"
  | "bot"
  | "users"
  | "user"
  | "trash"
  | "search"
  | "refresh"
  | "plus"
  | "activity"
  | "wrench"
  | "alertTriangle"
  | "check"
  | "x"
  | "palette"
  | "lock"
  | "heart"
  | "clock"
  | "download"
  | "package"
  | "shield"
  | "checkCircle"
  | "xCircle"
  | "sun"
  | "moon"
  | "coreblow";

function cbIcon(body: ReturnType<typeof svg>) {
  return html`<svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="100%"
    height="100%"
    fill="none"
    stroke="currentColor"
    stroke-width="1.65"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >${body}</svg>`;
}

/**
 * CoreBlow Sovereign Signature Icon Set
 * Custom-crafted avionics/instrument silhouettes with chamfered geometry,
 * core beacon dots, and 14% duotone accents — 100% unique to CoreBlow.
 */
export const icons: Record<IconName, ReturnType<typeof html>> = {
  // Chat — chamfered HUD dialogue frame with live signal waveform
  messageSquare: cbIcon(svg`
    <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h9.5l4 4v6.5A2.5 2.5 0 0 1 17.5 17H11l-4.5 3.5V17H6.5A2.5 2.5 0 0 1 4 14.5z" fill="currentColor" fill-opacity="0.14"/>
    <line x1="8.5" y1="9.5" x2="8.5" y2="12.5"/>
    <line x1="12" y1="7.8" x2="12" y2="14.2"/>
    <line x1="15.5" y1="9.8" x2="15.5" y2="12.2"/>
  `),

  // Overview — Mission Control radar scope with telemetry blips
  barChart: cbIcon(svg`
    <circle cx="12" cy="12" r="9" fill="currentColor" fill-opacity="0.12"/>
    <circle cx="12" cy="12" r="4.5" stroke-opacity="0.55"/>
    <path d="M12 12L18.2 6.8"/>
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>
    <circle cx="16.2" cy="8.4" r="1.3" fill="currentColor" stroke="none"/>
    <circle cx="8.5" cy="15.2" r="1.1" fill="currentColor" stroke="none"/>
  `),

  // Sessions — branching resumable thread timeline
  fileText: cbIcon(svg`
    <circle cx="7" cy="5.5" r="2.2" fill="currentColor" fill-opacity="0.22"/>
    <circle cx="7" cy="18.5" r="2.2" fill="currentColor" fill-opacity="0.14"/>
    <circle cx="17.5" cy="12" r="2.2" fill="currentColor" fill-opacity="0.22"/>
    <line x1="7" y1="7.7" x2="7" y2="16.3"/>
    <path d="M7 9.5c0 2.5 2.2 2.5 8.3 2.5"/>
    <path d="M13 15.5h5.5" stroke-opacity="0.55"/>
  `),

  // Usage & Metrics — harmonic token spectrum inside telemetry arc
  activity: cbIcon(svg`
    <path d="M3.5 16.5a8.5 8.5 0 0 1 17 0" fill="currentColor" fill-opacity="0.1"/>
    <line x1="7.5" y1="16.5" x2="7.5" y2="13"/>
    <line x1="10.5" y1="16.5" x2="10.5" y2="10"/>
    <line x1="13.5" y1="16.5" x2="13.5" y2="11.5"/>
    <line x1="16.5" y1="16.5" x2="16.5" y2="14"/>
    <line x1="4" y1="19.5" x2="20" y2="19.5"/>
    <circle cx="10.5" cy="7.2" r="1.2" fill="currentColor" stroke="none"/>
  `),

  // Cron Jobs — perpetual 24/7 orbital gyro with satellite pulse
  clock: cbIcon(svg`
    <ellipse cx="12" cy="12" rx="9.2" ry="4.6" transform="rotate(-30 12 12)" fill="currentColor" fill-opacity="0.1"/>
    <ellipse cx="12" cy="12" rx="9.2" ry="4.6" transform="rotate(30 12 12)" stroke-opacity="0.6"/>
    <circle cx="12" cy="12" r="2.2" fill="currentColor" fill-opacity="0.24"/>
    <circle cx="19.2" cy="7.8" r="1.5" fill="currentColor" stroke="none"/>
  `),

  // CoreHub — interlocking hexagonal module vault with snapping node
  package: cbIcon(svg`
    <path d="M10.5 3.2L16.5 6.6v6.8l-6 3.4-6-3.4V6.6z" fill="currentColor" fill-opacity="0.14"/>
    <path d="M16.5 11.2l4 2.3v4.6l-4 2.3-4-2.3v-2.1" fill="currentColor" fill-opacity="0.18"/>
    <circle cx="10.5" cy="10" r="1.6" fill="currentColor" stroke="none"/>
  `),

  // AI Agents — War Room sovereign hex core with orbital squad halo
  brain: cbIcon(svg`
    <path d="M12 6.8L16.2 9.2v4.8L12 16.4 7.8 14V9.2z" fill="currentColor" fill-opacity="0.2"/>
    <circle cx="12" cy="11.6" r="1.3" fill="currentColor" stroke="none"/>
    <path d="M4.2 14.5A8.5 8.5 0 0 1 12 3.2a8.5 8.5 0 0 1 7.8 11.3" stroke-opacity="0.55"/>
    <circle cx="5.2" cy="17.8" r="1.7"/>
    <circle cx="12" cy="20" r="1.7"/>
    <circle cx="18.8" cy="17.8" r="1.7"/>
  `),

  // Skills — sovereign capability microchip with neural spark core
  zap: cbIcon(svg`
    <rect x="6" y="6" width="12" height="12" rx="2.8" fill="currentColor" fill-opacity="0.14"/>
    <path d="M12 8.7l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z" fill="currentColor" stroke="none"/>
    <line x1="9.5" y1="3" x2="9.5" y2="6"/>
    <line x1="14.5" y1="3" x2="14.5" y2="6"/>
    <line x1="9.5" y1="18" x2="9.5" y2="21"/>
    <line x1="14.5" y1="18" x2="14.5" y2="21"/>
    <line x1="3" y1="9.5" x2="6" y2="9.5"/>
    <line x1="3" y1="14.5" x2="6" y2="14.5"/>
    <line x1="18" y1="9.5" x2="21" y2="9.5"/>
    <line x1="18" y1="14.5" x2="21" y2="14.5"/>
  `),

  // Config — precision chamfered hex vernier dial
  settings: cbIcon(svg`
    <path d="M8 3.2h8l4.8 4.8v8L16 20.8H8L3.2 16V8z" fill="currentColor" fill-opacity="0.12"/>
    <circle cx="12" cy="12" r="4"/>
    <line x1="12" y1="8" x2="12" y2="5.5"/>
    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/>
  `),

  // Debug — oscilloscope diagnostic brackets with anomaly spike
  bug: cbIcon(svg`
    <path d="M7.5 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h2.5"/>
    <path d="M16.5 4H19a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2.5"/>
    <path d="M6.5 12.5h2.2l1.8-4.5 2.5 8 2-3.5h2.5" fill="currentColor" fill-opacity="0.1"/>
    <circle cx="10.5" cy="8" r="1.2" fill="currentColor" stroke="none"/>
  `),

  // Logs — chamfered live ledger stream with active pulse dot
  scrollText: cbIcon(svg`
    <path d="M4 6a2 2 0 0 1 2-2h10l4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" fill="currentColor" fill-opacity="0.12"/>
    <circle cx="8" cy="8.5" r="1.2" fill="currentColor" stroke="none"/>
    <line x1="11" y1="8.5" x2="15.5" y2="8.5"/>
    <polyline points="7.5 12.5 9.5 14 7.5 15.5"/>
    <line x1="11.5" y1="14" x2="16.5" y2="14"/>
  `),

  link: cbIcon(svg`
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  `),

  radio: cbIcon(svg`
    <circle cx="12" cy="12" r="2" fill="currentColor"/>
    <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/>
  `),

  loader: cbIcon(svg`
    <path d="M12 3a9 9 0 1 0 9 9"/>
  `),

  monitor: cbIcon(svg`
    <rect x="2.5" y="3.5" width="19" height="13.5" rx="2.5" fill="currentColor" fill-opacity="0.12"/>
    <line x1="8" y1="20.5" x2="16" y2="20.5"/>
    <line x1="12" y1="17" x2="12" y2="20.5"/>
  `),

  send: cbIcon(svg`
    <path d="M21 3L10.5 13.5"/>
    <path d="M21 3l-6.8 18-3.7-7.5L3 9.8 21 3z" fill="currentColor" fill-opacity="0.14"/>
  `),

  spark: cbIcon(svg`
    <path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3z" fill="currentColor" fill-opacity="0.16"/>
  `),

  terminal: cbIcon(svg`
    <polyline points="4 17 10 11 4 5"/>
    <line x1="12" y1="19" x2="20" y2="19"/>
  `),

  globe: cbIcon(svg`
    <circle cx="12" cy="12" r="9.5" fill="currentColor" fill-opacity="0.1"/>
    <line x1="2.5" y1="12" x2="21.5" y2="12"/>
    <path d="M12 2.5a14.5 14.5 0 0 1 3.8 9.5 14.5 14.5 0 0 1-3.8 9.5 14.5 14.5 0 0 1-3.8-9.5A14.5 14.5 0 0 1 12 2.5z"/>
  `),

  folder: cbIcon(svg`
    <path d="M21 18.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4.5l2 2.5H19a2 2 0 0 1 2 2z" fill="currentColor" fill-opacity="0.12"/>
  `),

  eye: cbIcon(svg`
    <path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7z" fill="currentColor" fill-opacity="0.1"/>
    <circle cx="12" cy="12" r="2.8"/>
  `),

  eyeOff: cbIcon(svg`
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="2" y1="2" x2="22" y2="22"/>
  `),

  bot: cbIcon(svg`
    <rect x="3.5" y="9.5" width="17" height="11" rx="3" fill="currentColor" fill-opacity="0.14"/>
    <circle cx="12" cy="5" r="1.8"/>
    <line x1="12" y1="6.8" x2="12" y2="9.5"/>
    <circle cx="9" cy="15" r="1" fill="currentColor" stroke="none"/>
    <circle cx="15" cy="15" r="1" fill="currentColor" stroke="none"/>
  `),

  users: cbIcon(svg`
    <circle cx="9" cy="7.5" r="3.5" fill="currentColor" fill-opacity="0.14"/>
    <path d="M15.5 20.5v-1.8a3.8 3.8 0 0 0-3.8-3.8H6.3a3.8 3.8 0 0 0-3.8 3.8v1.8"/>
    <circle cx="17" cy="8.5" r="2.5"/>
    <path d="M21.5 20.5v-1.5a3 3 0 0 0-2.5-3"/>
  `),

  user: cbIcon(svg`
    <circle cx="12" cy="7.5" r="3.8" fill="currentColor" fill-opacity="0.14"/>
    <path d="M19 20.5v-1.8a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v1.8"/>
  `),

  trash: cbIcon(svg`
    <path d="M3.5 6h17"/>
    <path d="M18.5 6v13.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V6" fill="currentColor" fill-opacity="0.1"/>
    <path d="M8.5 6V4a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 4v2"/>
    <line x1="10" y1="10.5" x2="10" y2="16.5"/>
    <line x1="14" y1="10.5" x2="14" y2="16.5"/>
  `),

  search: cbIcon(svg`
    <circle cx="11" cy="11" r="7.5" fill="currentColor" fill-opacity="0.1"/>
    <line x1="20.5" y1="20.5" x2="16.4" y2="16.4"/>
  `),

  refresh: cbIcon(svg`
    <polyline points="22 4 22 10 16 10"/>
    <polyline points="2 20 2 14 8 14"/>
    <path d="M3.8 9a8.5 8.5 0 0 1 14.3-3.1L22 10M2 14l3.9 4.1A8.5 8.5 0 0 0 20.2 15"/>
  `),

  plus: cbIcon(svg`
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  `),

  wrench: cbIcon(svg`
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" fill="currentColor" fill-opacity="0.12"/>
  `),

  alertTriangle: cbIcon(svg`
    <path d="M10.3 3.9L2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" fill="currentColor" fill-opacity="0.14"/>
    <line x1="12" y1="9.5" x2="12" y2="13.5"/>
    <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none"/>
  `),

  check: cbIcon(svg`
    <polyline points="20 6 9 17 4 12"/>
  `),

  x: cbIcon(svg`
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  `),

  palette: cbIcon(svg`
    <circle cx="12" cy="12" r="9" fill="currentColor" fill-opacity="0.12"/>
    <circle cx="9" cy="10" r="1.2" fill="currentColor" stroke="none"/>
    <circle cx="14.5" cy="9" r="1.2" fill="currentColor" stroke="none"/>
    <circle cx="15.5" cy="14" r="1.2" fill="currentColor" stroke="none"/>
    <circle cx="9.5" cy="15" r="1.2" fill="currentColor" stroke="none"/>
  `),

  lock: cbIcon(svg`
    <rect x="4" y="11" width="16" height="10" rx="2.5" fill="currentColor" fill-opacity="0.14"/>
    <path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>
  `),

  heart: cbIcon(svg`
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" fill="currentColor" fill-opacity="0.14"/>
  `),

  download: cbIcon(svg`
    <path d="M20.5 15v3.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V15"/>
    <polyline points="7.5 10.5 12 15 16.5 10.5"/>
    <line x1="12" y1="15" x2="12" y2="3.5"/>
  `),

  shield: cbIcon(svg`
    <path d="M12 21.5s7.5-3.8 7.5-9.5V5.5L12 2.5l-7.5 3V12c0 5.7 7.5 9.5 7.5 9.5z" fill="currentColor" fill-opacity="0.14"/>
    <polyline points="9 12 11 14 15 9.8"/>
  `),

  checkCircle: cbIcon(svg`
    <circle cx="12" cy="12" r="9.5" fill="currentColor" fill-opacity="0.14"/>
    <polyline points="8.5 12.2 11 14.7 15.8 9.5"/>
  `),

  xCircle: cbIcon(svg`
    <circle cx="12" cy="12" r="9.5" fill="currentColor" fill-opacity="0.14"/>
    <line x1="15" y1="9" x2="9" y2="15"/>
    <line x1="9" y1="9" x2="15" y2="15"/>
  `),

  sun: cbIcon(svg`
    <circle cx="12" cy="12" r="4" fill="currentColor" fill-opacity="0.16"/>
    <path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/>
  `),

  moon: cbIcon(svg`
    <path d="M12.5 3a6.5 6.5 0 0 0 8.5 8.5A9 9 0 1 1 12.5 3z" fill="currentColor" fill-opacity="0.16"/>
  `),

  // CoreBlow Sovereign Core Emblem
  coreblow: cbIcon(svg`
    <path d="M12 2.5L20 7.1V16.9L12 21.5L4 16.9V7.1L12 2.5Z" fill="currentColor" fill-opacity="0.14"/>
    <path d="M15.4 8.2A5 5 0 1 0 15.4 15.8" stroke-width="1.95"/>
    <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/>
  `),
};

export function renderIcon(name: IconName, size = "1em", extraStyle = "") {
  return html`<span class="svg-icon" style="display:inline-flex; align-items:center; justify-content:center; width:${size}; height:${size}; flex-shrink:0; vertical-align:-0.15em; ${extraStyle}" aria-hidden="true">${icons[name] ?? icons.spark}</span>`;
}
