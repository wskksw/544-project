import { StudyWorkspace } from "@/components/StudyWorkspace";

export default async function SessionPage({
  params
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return (
    <main>
      <StudyWorkspace sessionId={sessionId} portalMode="researcher" />
    </main>
  );
}
