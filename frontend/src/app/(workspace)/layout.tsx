import type { ReactNode } from "react";
import { WorkspaceLayout } from "@/components/workspace";

export default function PortalLayout({ children }: { children: ReactNode }) {
  return <WorkspaceLayout>{children}</WorkspaceLayout>;
}
