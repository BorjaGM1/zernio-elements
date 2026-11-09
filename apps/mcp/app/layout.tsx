import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Zernio Elements MCP server",
  description: "Preview and approval widgets for posts an agent is about to publish through Zernio.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f6f6f5", color: "#111", font: "15px/1.55 ui-sans-serif, system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
