export default async function IssueDetailRoute({
  params,
}: { params: Promise<{ issueId: string }> }) {
  const { issueId } = await params;
  return <main data-testid="screen-issue-detail">{issueId}</main>;
}
