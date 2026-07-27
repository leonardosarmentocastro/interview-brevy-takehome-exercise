import { CasePage } from "@/modules/specialists/pages/CasePage";

export default async function CaseRoute({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  return <CasePage caseId={caseId} />;
}
