export const mattermostChannelConfigUiHints = {
  "": {
    label: "Mattermost",
    help: "Mattermost channel provider configuration for bot auth, access policy, slash commands, and preview streaming.",
  },
  dmPolicy: {
    label: "Mattermost DM Policy",
    help: 'Direct message access control ("pairing" recommended). "open" requires channels.mattermost.allowFrom=["*"].',
  },
  "streaming.preview.toolProgress": {
    label: "Mattermost Draft Tool Progress",
    help: "Show tool/progress activity in the live draft preview post.",
  },
  "streaming.preview.commandText": {
    label: "Mattermost Draft Command Text",
    help: 'Command/exec detail in preview tool-progress lines: "raw" or "status".',
  },
} as const;
