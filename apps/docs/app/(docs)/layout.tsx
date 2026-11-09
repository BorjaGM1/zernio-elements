import type { ReactNode } from "react";
import { SiteShell } from "@/components/site-shell";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return <SiteShell demoUrl={process.env.NEXT_PUBLIC_DEMO_URL}>{children}</SiteShell>;
}
