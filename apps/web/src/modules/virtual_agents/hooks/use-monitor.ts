import { useQuery } from "@tanstack/react-query";
import { fetchLocal } from "@/shared/api/local";
import type { MonitorSnapshot } from "@/modules/virtual_agents/types";

export function useMonitor() {
  return useQuery({
    queryKey: ["virtual_agents", "monitor"],
    queryFn: () => fetchLocal<MonitorSnapshot>("/api/virtual_agents/monitor"),
  });
}
