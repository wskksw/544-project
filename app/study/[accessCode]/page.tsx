import { StudyWorkspace } from "@/components/StudyWorkspace";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveSessionByAccessCode } from "@/lib/sessionManager";
import Link from "next/link";

export default async function StudySessionPage({
  params
}: {
  params: Promise<{ accessCode: string }>;
}) {
  const { accessCode } = await params;

  try {
    const resolved = resolveSessionByAccessCode(accessCode);

    return (
      <main>
        <StudyWorkspace
          sessionId={resolved.sessionId}
          portalMode="participant"
          participantAccessCode={resolved.accessCode}
        />
      </main>
    );
  } catch (error) {
    return (
      <main>
        <Card>
          <CardHeader>
            <CardTitle>Invalid Access Code</CardTitle>
          </CardHeader>
          <CardContent className="stack-sm">
            <p>{error instanceof Error ? error.message : "Unable to load session."}</p>
            <Link className={buttonVariants({ variant: "link" })} href="/study">
              Return to login
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }
}
