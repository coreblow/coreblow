import React from "react";

interface LayoutProps {
  sidebar: React.ReactNode;
  topbar: React.ReactNode;
  content: React.ReactNode;
  inspector: React.ReactNode;
  statusBar?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  sidebar,
  topbar,
  content,
  inspector,
  statusBar,
}) => {
  return (
    <div
      style={{
        display: "flex",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "var(--bg-canvas)",
      }}
    >
      {/* Left Sidebar */}
      {sidebar}

      {/* Center Canvas */}
      <div
        style={{
          flex: 1,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          minWidth: "400px",
          overflow: "hidden",
        }}
      >
        {topbar}
        <main
          style={{
            flex: 1,
            height: statusBar ? "calc(100% - var(--topbar-height) - 24px)" : "calc(100% - var(--topbar-height))",
            position: "relative",
          }}
        >
          {content}
        </main>
        {statusBar}
      </div>

      {/* Right Inspector Drawer */}
      {inspector}
    </div>
  );
};
