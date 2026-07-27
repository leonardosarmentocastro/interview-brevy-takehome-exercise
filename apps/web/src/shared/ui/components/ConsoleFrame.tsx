"use client";
import { useAtom } from "jotai";
import { usePathname } from "next/navigation";
import { roleAtom } from "../data/atoms/role";
import { AppHeader } from "./AppHeader";
import { PipelineNav } from "./PipelineNav";
import { RoleModal } from "./RoleModal";
import { PolicyModal } from "@/shared/policies/components/PolicyModal";
import type { ReactNode } from "react";
import "../style.css";

export function ConsoleFrame({ children }: { children: ReactNode }) {
  const [role, setRole] = useAtom(roleAtom);
  const pathname = usePathname();
  const hideAppbar = pathname === "/monitors/agents/drill";
  return (
    <>
      <div className="wrap">
        {hideAppbar ? null : (
          <AppHeader onSwitchRole={() => setRole(null)} />
        )}
        {children}
        <PipelineNav />
      </div>
      <RoleModal open={role === null} onPick={(r) => setRole(r)} />
      <PolicyModal />
    </>
  );
}
