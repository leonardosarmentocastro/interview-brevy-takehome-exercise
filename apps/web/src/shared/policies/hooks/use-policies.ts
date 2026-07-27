import { useQuery } from "@tanstack/react-query";
import { fetchLocal } from "@/shared/api/local";
export function usePolicies() {
  return useQuery({
    queryKey: ["policies"],
    queryFn: () => fetchLocal<{ lines: string[] }>("/api/policies"),
  });
}
