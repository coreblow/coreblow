import { Tab } from "./types.ts";

export const TAB_GROUPS = [
  { label: "chat", tabs: ["chat"] },
  {
    label: "control",
    tabs: ["overview", "sessions", "usage", "cron"],
  },
  { label: "agent", tabs: ["aiAgents", "skills"] },
  {
    label: "settings",
    tabs: [
      "config",
      "debug",
      "logs",
    ],
  },
] as const;

export type { Tab };

export function iconForTab(tab: Tab): string {
  switch (tab) {
    case "chat":
      return "messageSquare";
    case "overview":
      return "barChart";
    case "sessions":
      return "fileText";
    case "usage":
      return "barChart";
    case "cron":
      return "loader";
    case "skills":
      return "zap";
    case "aiAgents":
      return "brain";
    case "config":
      return "settings";
    case "debug":
      return "bug";
    case "logs":
      return "scrollText";
    default:
      return "folder";
  }
}

export function titleForTab(tab: Tab) {
  const titles: Record<string, string> = {
    chat: "Chat",
    overview: "Overview",
    sessions: "Sessions",
    usage: "Usage",
    cron: "Cron Jobs",
    skills: "Skills",
    config: "Config",
    aiAgents: "AI Agents",
    debug: "Debug",
    logs: "Logs",
  };
  return titles[tab] || tab;
}
