import React from "react";
import type { UpdateStatus } from "../../electron/preload";

export interface UpdateBannerProps {
  status: UpdateStatus | null;
  dismissedVersion: string | null;
  onDownloadAndRestart: () => void;
  onInstallNow: () => void;
  onDismiss: () => void;
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({
  status,
  dismissedVersion,
  onDownloadAndRestart,
  onInstallNow,
  onDismiss,
}) => {
  if (!status) {
    return null;
  }

  const shouldShow =
    status.phase === "available" ||
    status.phase === "downloading" ||
    status.phase === "downloaded";

  if (!shouldShow) {
    return null;
  }

  const versionTag = status.availableVersion ?? status.currentVersion;
  if (status.phase === "available" && dismissedVersion && dismissedVersion === versionTag) {
    return null;
  }

  const headline =
    status.phase === "downloaded"
      ? `CoreBlow v${versionTag} is ready to install`
      : status.phase === "downloading"
        ? `Downloading CoreBlow v${versionTag} (${Math.round(status.progressPercent ?? 0)}%)`
        : `CoreBlow v${versionTag} is available`;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="update-banner"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        padding: "8px 14px",
        background: "#171C1F",
        borderBottom: "1px solid rgba(233, 84, 32, 0.35)",
        color: "#F3F4F6",
        fontSize: "12.5px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
        <span
          aria-hidden="true"
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "#E95420",
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 600 }}>{headline}</span>
        {status.phase === "available" && (
          <span style={{ color: "#9CA3AF" }}>Desktop release ready from GitHub</span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        {status.phase === "available" && (
          <button
            type="button"
            onClick={onDownloadAndRestart}
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              border: "none",
              background: "#E95420",
              color: "#FFFFFF",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Download &amp; Restart
          </button>
        )}

        {status.phase === "downloaded" && (
          <button
            type="button"
            onClick={onInstallNow}
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              border: "none",
              background: "#E95420",
              color: "#FFFFFF",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Restart to Update
          </button>
        )}

        {status.phase !== "downloaded" && (
          <button
            type="button"
            onClick={onDismiss}
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "transparent",
              color: "#D1D5DB",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            Later
          </button>
        )}
      </div>
    </div>
  );
};
