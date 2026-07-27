import { useQuery } from "@tanstack/react-query";
import { fetchLocal } from "@/shared/api/local";
import type { SpecialistSnapshot } from "@/modules/specialists/types";

export function useSpecialist() {
  return useQuery({
    queryKey: ["specialists", "board"],
    queryFn: () => fetchLocal<SpecialistSnapshot>("/api/specialists/board"),
  });
}
