import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <div className="card">
        <h1>AIMC Study Prototype</h1>
        <p>
          Shared writing interface with experimentally controlled AI roles (Drafter, Revisor,
          Facilitator), state-machine enforcement, and first-class logging.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link href="/researcher">
            <button className="primary" type="button">
              Researcher Control Panel
            </button>
          </Link>
          <Link href="/researcher/playground">
            <button type="button">Condition Playground</button>
          </Link>
        </div>
      </div>
    </main>
  );
}
