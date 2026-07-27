"use client";
import { useAtom } from "jotai";
import { roleAtom } from "../data/atoms/role";
import { AppHeader } from "./AppHeader";
import { PipelineNav } from "./PipelineNav";
import { RoleModal } from "./RoleModal";
import type { ReactNode } from "react";
import "../style.css";

export function ConsoleFrame({ children }: { children: ReactNode }) {
  const [role, setRole] = useAtom(roleAtom);
  return (
    <>
      <div className="wrap">
        <AppHeader onSwitchRole={() => setRole(null)} />
        {children}
        <PipelineNav />
      </div>
      <RoleModal open={role === null} onPick={(r) => setRole(r)} />
    </>
  );
}
