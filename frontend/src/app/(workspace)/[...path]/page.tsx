"use client";

import { usePathname } from "next/navigation";
import { WorkspacePage } from "@/components/workspace";

export default function PortalPage() {
  return <WorkspacePage pathname={usePathname()} />;
}
