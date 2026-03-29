import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-stack">
      <Card>
        <CardHeader>
          <CardTitle>AIMC Study Platform</CardTitle>
          <CardDescription>
            Two-portal flow: researcher control console for assignment + monitoring, and participant
            access-code login for study completion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="row-wrap">
            <Link className={buttonVariants()} href="/study">
              Participant Portal
            </Link>
            <Link className={buttonVariants({ variant: "outline" })} href="/researcher">
              Researcher Console
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
