import { ResearcherControlPanel } from "@/components/ResearcherControlPanel";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";

export default function ResearcherPage() {
  return (
    <main className="page-stack">
      <div className="row-wrap">
        <Link className={buttonVariants({ variant: "link" })} href="/">
          Back
        </Link>
        <Link className={buttonVariants({ variant: "outline" })} href="/researcher/surveys">
          Survey Area
        </Link>
      </div>
      <ResearcherControlPanel />
    </main>
  );
}
