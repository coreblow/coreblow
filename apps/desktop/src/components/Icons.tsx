import React from "react";

interface IconProps {
  size?: number;
  className?: string;
  color?: string;
}

/**
 * CoreBlow Sovereign Signature Icon Set (React / Electron Desktop)
 * 1-to-1 visual parity with Web Control UI (ui/src/ui/icons.ts):
 * chamfered instrument silhouettes, core beacon dots, and subtle duotone accents.
 */

// CoreBlow Sovereign Core Emblem
export const CoreBlowEmblem: React.FC<IconProps> = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2.5L20 7.1V16.9L12 21.5L4 16.9V7.1L12 2.5Z" fill={color} fillOpacity="0.14" />
    <path d="M15.4 8.2A5 5 0 1 0 15.4 15.8" strokeWidth="1.95" />
    <circle cx="12" cy="12" r="2.2" fill={color} stroke="none" />
  </svg>
);

export const PlusIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const TrashIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.5 6h17" />
    <path d="M18.5 6v13.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V6" fill={color} fillOpacity="0.1" />
    <path d="M8.5 6V4a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 4v2" />
    <line x1="10" y1="10.5" x2="10" y2="16.5" />
    <line x1="14" y1="10.5" x2="14" y2="16.5" />
  </svg>
);

export const SearchIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7.5" fill={color} fillOpacity="0.1" />
    <line x1="20.5" y1="20.5" x2="16.4" y2="16.4" />
  </svg>
);

// Config / Settings — precision chamfered hex vernier dial
export const SettingsIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3.2h8l4.8 4.8v8L16 20.8H8L3.2 16V8z" fill={color} fillOpacity="0.12" />
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="8" x2="12" y2="5.5" />
    <circle cx="12" cy="12" r="1.3" fill={color} stroke="none" />
  </svg>
);

export const SidebarToggleIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill={color} fillOpacity="0.08" />
    <line x1="9" y1="3" x2="9" y2="21" />
  </svg>
);

export const InspectorIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill={color} fillOpacity="0.08" />
    <line x1="15" y1="3" x2="15" y2="21" />
  </svg>
);

export const SendIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
);

export const StopIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

export const CopyIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" fill={color} fillOpacity="0.1" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

export const CheckIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const GitBranchIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <line x1="6" y1="3" x2="6" y2="15" />
    <circle cx="18" cy="6" r="3" fill={color} fillOpacity="0.14" />
    <circle cx="6" cy="18" r="3" fill={color} fillOpacity="0.14" />
    <path d="M18 9a9 9 0 0 1-9 9" />
  </svg>
);

export const FolderIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 18.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4.5l2 2.5H19a2 2 0 0 1 2 2z" fill={color} fillOpacity="0.12" />
  </svg>
);

export const ShieldIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21.5s7.5-3.8 7.5-9.5V5.5L12 2.5l-7.5 3V12c0 5.7 7.5 9.5 7.5 9.5z" fill={color} fillOpacity="0.14" />
    <polyline points="9 12 11 14 15 9.8" />
  </svg>
);

// Models — stacked isometric neural inference layers
export const SparklesIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 3.2 20.5 7.8 12 12.4 3.5 7.8 12 3.2" fill={color} fillOpacity="0.16" />
    <polyline points="3.5 12.2 12 16.8 20.5 12.2" />
    <polyline points="3.5 16.4 12 21 20.5 16.4" />
  </svg>
);

export const TerminalIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

export const CloseIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const ChevronDownIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export const RefreshIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 4 22 10 16 10" />
    <polyline points="2 20 2 14 8 14" />
    <path d="M3.8 9a8.5 8.5 0 0 1 14.3-3.1L22 10M2 14l3.9 4.1A8.5 8.5 0 0 0 20.2 15" />
  </svg>
);

export const MicIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="3" width="6" height="10.5" rx="3" fill={color} fillOpacity="0.16" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
    <line x1="12" y1="18" x2="12" y2="21" />
    <line x1="9" y1="21" x2="15" y2="21" />
  </svg>
);

export const SpeakerIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill={color} fillOpacity="0.14" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);

export const VolumeXIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill={color} fillOpacity="0.14" />
    <line x1="22" y1="9" x2="16" y2="15" />
    <line x1="16" y1="9" x2="22" y2="15" />
  </svg>
);

export const ChevronUpIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

export const UsersIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="7.5" r="3.5" fill={color} fillOpacity="0.14" />
    <path d="M15.5 20.5v-1.8a3.8 3.8 0 0 0-3.8-3.8H6.3a3.8 3.8 0 0 0-3.8 3.8v1.8" />
    <circle cx="17" cy="8.5" r="2.5" />
    <path d="M21.5 20.5v-1.5a3 3 0 0 0-2.5-3" />
  </svg>
);

export const PinIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="17" x2="12" y2="22" />
    <path d="M5 17h14v-2l-2-3V5a2 2 0 0 0-2-2h-6a2 2 0 0 0-2 2v7l-2 3v2z" fill={color} fillOpacity="0.14" />
  </svg>
);

// AI Agents / War Room Squad — sovereign hex core with orbital squad halo
export const AgentsBrainIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 6.8L16.2 9.2v4.8L12 16.4 7.8 14V9.2z" fill={color} fillOpacity="0.2" />
    <circle cx="12" cy="11.6" r="1.3" fill={color} stroke="none" />
    <path d="M4.2 14.5A8.5 8.5 0 0 1 12 3.2a8.5 8.5 0 0 1 7.8 11.3" strokeOpacity="0.55" />
    <circle cx="5.2" cy="17.8" r="1.7" />
    <circle cx="12" cy="20" r="1.7" />
    <circle cx="18.8" cy="17.8" r="1.7" />
  </svg>
);

// Capabilities 4-point diamond sparkle
export const DiamondSparkIcon: React.FC<IconProps> = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
    <path d="M12 2L14.8 9.2L22 12L14.8 14.8L12 22L9.2 14.8L2 12L9.2 9.2L12 2Z" />
  </svg>
);

// Skills — sovereign capability microchip with 4-point neural spark core
export const SkillsChipIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="6" width="12" height="12" rx="2.8" fill={color} fillOpacity="0.14" />
    <path d="M12 8.7l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z" fill={color} stroke="none" />
    <line x1="9.5" y1="3" x2="9.5" y2="6" />
    <line x1="14.5" y1="3" x2="14.5" y2="6" />
    <line x1="9.5" y1="18" x2="9.5" y2="21" />
    <line x1="14.5" y1="18" x2="14.5" y2="21" />
    <line x1="3" y1="9.5" x2="6" y2="9.5" />
    <line x1="3" y1="14.5" x2="6" y2="14.5" />
    <line x1="18" y1="9.5" x2="21" y2="9.5" />
    <line x1="18" y1="14.5" x2="21" y2="14.5" />
  </svg>
);

// Memory — stylized dual-hemisphere brain
export const MemoryBrainIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 4.5a3 3 0 0 0-3 2.7A3.2 3.2 0 0 0 4 10.3a3.1 3.1 0 0 0 1.4 2.6A3.2 3.2 0 0 0 6.8 18a3 3 0 0 0 2.7 1.7c1.4 0 2.5-1.1 2.5-2.5V7a2.5 2.5 0 0 0-2.5-2.5z" fill={color} fillOpacity="0.14" />
    <path d="M14.5 4.5a3 3 0 0 1 3 2.7A3.2 3.2 0 0 1 20 10.3a3.1 3.1 0 0 1-1.4 2.6A3.2 3.2 0 0 1 17.2 18a3 3 0 0 1-2.7 1.7c-1.4 0-2.5-1.1-2.5-2.5V7a2.5 2.5 0 0 1 2.5-2.5z" fill={color} fillOpacity="0.14" />
    <path d="M9.5 9.5a2 2 0 0 1-2 1.8" />
    <path d="M14.5 9.5a2 2 0 0 0 2 1.8" />
    <path d="M9.5 14.5a2 2 0 0 0-1.8 1.2" />
    <path d="M14.5 14.5a2 2 0 0 1 1.8 1.2" />
  </svg>
);

// Cron Jobs / Scheduled Automations — precision chronograph timer dial
export const ClockIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="13" r="7.5" fill={color} fillOpacity="0.12" />
    <line x1="9.5" y1="2.8" x2="14.5" y2="2.8" />
    <line x1="12" y1="2.8" x2="12" y2="5.5" />
    <polyline points="12 9 12 13 15 14.8" />
    <circle cx="12" cy="13" r="1.1" fill={color} stroke="none" />
  </svg>
);

// Channels — live broadcast signal waves
export const RadioIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="2" fill={color} />
    <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
  </svg>
);

// MCP — CoreBlow S-curve protocol node conduit with duotone core beacons
export const McpConduitIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="3" fill={color} fillOpacity="0.16" />
    <circle cx="6" cy="6" r="1" fill={color} stroke="none" />
    <circle cx="18" cy="18" r="3" fill={color} fillOpacity="0.16" />
    <circle cx="18" cy="18" r="1" fill={color} stroke="none" />
    <path d="M9 6a3 3 0 0 1 3 3v6a3 3 0 0 0 3 3" />
  </svg>
);

// Remote Nodes — dual rack server daemon blades
export const ServerIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="6.5" rx="1.8" fill={color} fillOpacity="0.14" />
    <rect x="3" y="13.5" width="18" height="6.5" rx="1.8" fill={color} fillOpacity="0.1" />
    <circle cx="7" cy="7.25" r="1" fill={color} stroke="none" />
    <circle cx="7" cy="16.75" r="1" fill={color} stroke="none" />
    <line x1="11" y1="7.25" x2="17.5" y2="7.25" />
    <line x1="11" y1="16.75" x2="17.5" y2="16.75" />
  </svg>
);

// Usage & Metrics — ascending telemetry area-sparkline with peak beacon
export const ActivityIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.5 19.5h17" strokeOpacity="0.55" />
    <path d="M4.5 15.5l4.2-4.2 3.3 2.7 5.8-7.2V19.5H4.5z" fill={color} fillOpacity="0.14" stroke="none" />
    <path d="M4.5 15.5l4.2-4.2 3.3 2.7 5.8-7.2" />
    <circle cx="17.8" cy="6.8" r="1.8" fill={color} stroke="none" />
    <circle cx="8.7" cy="11.3" r="1.1" fill={color} stroke="none" />
  </svg>
);

// CoreHub — interlocking hexagonal module vault with snapping node
export const CoreHubIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.5 3.2L16.5 6.6v6.8l-6 3.4-6-3.4V6.6z" fill={color} fillOpacity="0.14" />
    <path d="M16.5 11.2l4 2.3v4.6l-4 2.3-4-2.3v-2.1" fill={color} fillOpacity="0.18" />
    <circle cx="10.5" cy="10" r="1.6" fill={color} stroke="none" />
  </svg>
);

// Compass — navigation instrument with 4-point needle
export const CompassIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" fill={color} fillOpacity="0.08" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill={color} fillOpacity="0.2" />
    <circle cx="12" cy="12" r="1.5" fill={color} stroke="none" />
  </svg>
);

// Globe — network navigation sphere with latitude/longitude meridians
export const GlobeIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" fill={color} fillOpacity="0.08" />
    <path d="M12 3a14.5 14.5 0 0 0 0 18 14.5 14.5 0 0 0 0-18z" />
    <line x1="3" y1="12" x2="21" y2="12" />
  </svg>
);

// GridTools — 2x2 modular tool suite matrix
export const GridToolsIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" fill={color} fillOpacity="0.12" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" fill={color} fillOpacity="0.12" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" fill={color} fillOpacity="0.12" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" fill={color} fillOpacity="0.12" />
  </svg>
);

// ExpandPane — bidirectional expand / collapse pane
export const ExpandPaneIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

// SplitPane — vertical dual-pane toggle
export const SplitPaneIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="16" rx="2" fill={color} fillOpacity="0.08" />
    <line x1="12" y1="4" x2="12" y2="20" />
  </svg>
);
