import { ResearcherControlPanel } from "@/components/ResearcherControlPanel";
import Link from "next/link";

export default function ResearcherPage() {
  return (
    <main>
      <div style={{ marginBottom: "0.8rem" }}>
        <Link href="/">Back</Link>
      </div>
      <ResearcherControlPanel />
    </main>
  );
}
