import { and, eq, isNull } from "drizzle-orm";
import { Form, Link } from "react-router";

import type { Route } from "./+types/specimens";
import { SpecimenSigil } from "../components/SpecimenSigil";
import { ThemeToggle } from "../components/ThemeToggle";
import { createDb } from "../db/client.server";
import { records } from "../db/schema";
import { requireUser, toPublicCurrentUser } from "../services/auth.server";
import { getCloudflareEnv } from "../services/cloudflare.server";
import { generateRecordIdentity, type RecordClassification } from "../services/record-identity";
import { compareSpecimenUuids } from "../services/specimen-collection";

const classifications: RecordClassification[] = ["singular", "exceptional", "rare", "uncommon", "common"];

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Your Specimens | uuid.social" },
    { name: "description", content: "Your deterministic record specimens, ordered from rarest to most common." },
  ];
}

export function headers() {
  return { "Cache-Control": "private, no-store" };
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const currentUser = await requireUser(request, context);
  const db = createDb(getCloudflareEnv(context).DB);
  const specimenRecords = await db.select({ id: records.id })
    .from(records)
    .where(and(eq(records.userId, currentUser.id), isNull(records.deletedAt)));

  specimenRecords.sort((first, second) => compareSpecimenUuids(first.id, second.id));
  return {
    currentUser: toPublicCurrentUser(currentUser)!,
    records: specimenRecords,
  };
}

export default function Specimens({ loaderData }: Route.ComponentProps) {
  const specimens = loaderData.records.map((record) => ({
    record,
    identity: generateRecordIdentity(record.id),
  }));
  const counts = Object.fromEntries(classifications.map((classification) => [
    classification,
    specimens.filter((specimen) => specimen.identity.classification === classification).length,
  ])) as Record<RecordClassification, number>;

  return (
    <div className="min-h-screen bg-base-200 specimen-collection-shell">
      <header className="navbar bg-base-100 shadow-sm px-4 lg:px-8 sticky top-0 z-10">
        <div className="navbar-start"><Link className="font-bold tracking-widest uppercase text-sm" to="/home">uuid.social</Link></div>
        <div className="navbar-end gap-1">
          <Link className="btn btn-ghost btn-sm" to="/home">Home</Link>
          <Link className="btn btn-ghost btn-sm" to="/bounties">Bounties</Link>
          <ThemeToggle />
          <Form action="/logout" method="post"><button className="btn btn-ghost btn-sm">Logout</button></Form>
        </div>
      </header>
      <main className="specimen-collection-page">
        <header className="specimen-collection-hero">
          <div><p>Your field archive</p><h1>Specimens</h1><span>Every active record and reply by @{loaderData.currentUser.username}, ordered from mathematically rarest to most common.</span></div>
          <strong>{specimens.length.toLocaleString("en-US")}<small>cataloged</small></strong>
        </header>
        <div className="specimen-collection-counts" aria-label="Specimen classification counts">
          {classifications.map((classification) => <div className={`specimen-class-${classification}`} key={classification}><span>{classification}</span><strong>{counts[classification]}</strong></div>)}
        </div>
        {specimens.length === 0 ? (
          <section className="specimen-collection-empty"><h2>No specimens yet</h2><p>Publish a record or reply to create your first deterministic identity.</p><Link className="btn btn-primary btn-sm" to="/home">Create a record</Link></section>
        ) : (
          <section className="specimen-collection-grid" aria-label="Your specimens">
            {specimens.map(({ record, identity }, index) => (
              <Link className={`specimen-collection-card specimen-class-${identity.classification}`} key={record.id} to={`/record/${record.id}`}>
                <div className="specimen-collection-index">{String(index + 1).padStart(3, "0")}</div>
                <SpecimenSigil identity={identity} />
                <div className="specimen-collection-card-body">
                  <div className="specimen-collection-labels"><span>Specimen</span><strong>{identity.classification}</strong></div>
                  <h2>{identity.name}</h2>
                  <p className="specimen-collection-uuid">{record.id}</p>
                  <div className="specimen-collection-trait"><span>{identity.traits[0].label}</span><small>Approx. 1 in {identity.traits[0].oneIn.toLocaleString("en-US")}</small></div>
                  <footer><span>Open thread →</span></footer>
                </div>
              </Link>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
