import React from "react";

export interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
  verticalAlign?: "center" | "flex-start";
  badge?: string;
}

export const SettingRow: React.FC<SettingRowProps> = ({
  label,
  description,
  children,
  verticalAlign = "center",
  badge,
}) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: verticalAlign,
        justifyContent: "space-between",
        gap: "24px",
        padding: "12px 0",
        borderBottom: "1px solid var(--border-subtle)",
        boxSizing: "border-box",
      }}
    >
      <div style={{ flex: 1, minWidth: 0, paddingRight: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--ink-primary)",
              lineHeight: 1.4,
            }}
          >
            {label}
          </span>
          {badge && (
            <span
              style={{
                fontSize: "10px",
                fontWeight: 600,
                letterSpacing: "0.04em",
                padding: "2px 6px",
                borderRadius: "4px",
                background: "var(--accent-teal-subtle)",
                color: "var(--accent-teal)",
                border: "1px solid var(--accent-teal-glow)",
              }}
            >
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p
            style={{
              margin: "2px 0 0",
              fontSize: "12px",
              color: "var(--ink-muted)",
              lineHeight: 1.45,
            }}
          >
            {description}
          </p>
        )}
      </div>
      <div
        style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "flex-end" }}
      >
        {children}
      </div>
    </div>
  );
};

export interface SettingGroupProps {
  title: string;
  children: React.ReactNode;
}

export const SettingGroup: React.FC<SettingGroupProps> = ({ title, children }) => {
  return (
    <div style={{ marginBottom: "24px" }}>
      <div
        style={{
          fontSize: "10.5px",
          fontWeight: 700,
          letterSpacing: "0.08em",
          color: "var(--ink-muted)",
          textTransform: "uppercase",
          paddingBottom: "6px",
          borderBottom: "1px solid var(--border-medium)",
          marginBottom: "4px",
        }}
      >
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
};

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  ariaLabel,
}) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: "36px",
        height: "20px",
        borderRadius: "10px",
        background: checked ? "var(--accent-teal)" : "var(--border-medium)",
        position: "relative",
        cursor: disabled ? "not-allowed" : "pointer",
        border: "none",
        padding: 0,
        outline: "none",
        transition: "background 0.15s ease",
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "2px",
          left: checked ? "18px" : "2px",
          width: "16px",
          height: "16px",
          borderRadius: "50%",
          background: "#FFFFFF",
          boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
          transition: "left 0.15s ease",
        }}
      />
    </button>
  );
};
