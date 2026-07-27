import { IssueDetailPage } from "@/modules/operators/pages/IssueDetailPage";

export default async function Route({
  params,
}: {
  params: Promise<{ issueId: string }>;
}) {
  const { issueId } = await params;
  return <IssueDetailPage issueId={issueId} />;
}
