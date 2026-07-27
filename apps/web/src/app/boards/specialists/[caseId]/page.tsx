export default async function CaseRoute({
  params,
}: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  return <main data-testid="screen-case">{caseId}</main>;
}
