import { RunDetailView } from "@/components/runs/run-detail-view";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RunDetailView id={id} />;
}
