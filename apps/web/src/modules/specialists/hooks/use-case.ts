import { useQuery } from "@tanstack/react-query";
import { fetchLocal } from "@/shared/api/local";
import type { SpecialistCase } from "@/modules/specialists/types";

export function useCase(id: string) {
  return useQuery({
    queryKey: ["specialists", "case", id],
    queryFn: () =>
      fetchLocal<SpecialistCase>(`/api/specialists/cases/${id}`),
    enabled: !!id,
  });
}
