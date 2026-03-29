import { ResearcherSurveyArea } from "@/components/ResearcherSurveyArea";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";

export default function ResearcherSurveysPage() {
  return (
    <main className="page-stack">
      <div className="row-wrap">
        <Link className={buttonVariants({ variant: "link" })} href="/researcher">
          Participant Dash
        </Link>
      </div>
      <ResearcherSurveyArea />
    </main>
  );
}
