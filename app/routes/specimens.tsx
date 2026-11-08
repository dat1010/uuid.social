import { and, eq, isNull } from "drizzle-orm";
import { data, Form, Link, useNavigation } from "react-router";

import type { Route } from "./+types/specimens";
import { SpecimenCollectionCard } from "../components/SpecimenCollectionCard";
import { ThemeToggle } from "../components/ThemeToggle";
import { createDb } from "../db/client.server";
import { records } from "../db/schema";
import { requireUser, toPublicCurrentUser } from "../services/auth.server";
import { getCloudflareEnv } from "../services/cloudflare.server";
import { getFeaturedSpecimen, setFeaturedSpecimen } from "../services/featured-specimen.server";
import { classifications, getSpecimenPage } from "../services/specimen-collection";

export function meta() {
  return [
    { title: "Your Specimens | uuid.social" },
    { name: "description", content: "Explore your record specimens and feature a favorite on your profile." },
  ];
}

export function headers() {
  return { "Cache-Control": "private, no-store" };
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const currentUser = await requireUser(request, context);
  const env = getCloudflareEnv(context);
  const db = createDb(env.DB);
  const [specimenRecords, featured] = await Promise.all([
    db.select({ id: records.id }).from(records)
      .where(and(eq(records.userId, currentUser.id), isNull(records.deletedAt))),
    getFeaturedSpecimen(env.DB, currentUser.id),
  ]);
  return {
    currentUser: toPublicCurrentUser(currentUser)!,
    featuredId: featured?.id ?? null,
    ...getSpecimenPage(specimenRecords, new URL(request.url)),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const currentUser = await requireUser(request, context);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const recordId = String(form.get("recordId") ?? "").trim().toLowerCase();
  if ((intent !== "feature" && intent !== "unfeature") || (intent === "feature" && !recordId)) {
    return data({ error: "Choose a specimen to feature.", message: null }, { status: 400 });
  }
  const error = await setFeaturedSpecimen(
    getCloudflareEnv(context).DB, currentUser.id, intent === "feature" ? recordId : null,
  );
  if (error) return data({ error, message: null }, { status: 400 });
  return { error: null, message: intent === "feature" ? "Featured specimen updated on your profile." : "Featured specimen removed from your profile." };
}

export default function Specimens({ loaderData, actionData }: Route.ComponentProps) {
  const { currentUser, specimens, total, matched, counts, regions, classification, region, query, page, pageCount, featuredId } = loaderData;
  const navigation = useNavigation();
  const saving = navigation.state !== "idle" && navigation.formMethod === "POST";
  const pageLink = (nextPage: number) => `/specimens?${new URLSearchParams({ classification, region, q: query, page: String(nextPage) })}`;

  return (
    <div className="min-h-screen bg-base-200 specimen-collection-shell">
      <header className="navbar bg-base-100 shadow-sm px-4 lg:px-8 sticky top-0 z-10">
        <div className="navbar-start"><Link className="font-bold tracking-widest uppercase text-sm" to="/home">uuid.social</Link></div>
        <div className="navbar-end gap-1">
          <Link className="btn btn-ghost btn-sm" to="/home">Home</Link>
          <ThemeToggle />
          <Form action="/logout" method="post"><button className="btn btn-ghost btn-sm">Logout</button></Form>
        </div>
      </header>
      <main className="specimen-collection-page">
        <header className="specimen-collection-hero">
          <div><p>Your field archive</p><h1>Specimens</h1><span>Every active record and reply by @{currentUser.username}, ordered from rarest to most common. Feature a favorite on <Link className="link" to={`/user/${currentUser.username}`}>your profile</Link>.</span></div>
          <strong>{total.toLocaleString("en-US")}<small>cataloged</small></strong>
        </header>
        <div className="specimen-collection-counts" aria-label="Specimen classification counts">
          {classifications.map((tier) => <div className={`specimen-class-${tier}`} key={tier}><span>{tier}</span><strong>{counts[tier]}</strong></div>)}
        </div>
        <Form method="get" className="specimen-filters" key={`${classification}:${region}:${query}`}>
          <label>Classification<select className="select select-bordered w-full" name="classification" defaultValue={classification}><option value="">All classifications</option>{classifications.map((tier) => <option key={tier} value={tier}>{tier}</option>)}</select></label>
          <label>Region<select className="select select-bordered w-full" name="region" defaultValue={region}><option value="">All regions</option>{regions.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="specimen-filter-search">Find a specimen<input className="input input-bordered w-full" type="search" name="q" defaultValue={query} maxLength={200} placeholder="Name, trait, or UUID" /></label>
          <button className="btn btn-primary" type="submit">Filter</button>
          {(classification || region || query) && <Link className="btn btn-ghost" to="/specimens">Clear</Link>}
        </Form>
        {actionData?.error && <p className="alert alert-error mb-4" role="alert">{actionData.error}</p>}
        {actionData?.message && <p className="alert mb-4" role="status">{actionData.message}</p>}
        {featuredId && <div className="flex flex-wrap items-center justify-between gap-3 mb-6 text-sm">
          <Link className="link" to={`/record/${featuredId}`}>View your featured specimen</Link>
          <Form method="post"><button className="btn btn-ghost btn-sm" name="intent" value="unfeature" disabled={saving}>Remove from profile</button></Form>
        </div>}
        {specimens.length === 0 ? (
          <section className="specimen-collection-empty"><h2>{total === 0 ? "No specimens yet" : "No matching specimens"}</h2><p>{total === 0 ? "Publish a record or reply to discover your first specimen." : "Try another classification, region, or search."}</p><Link className="btn btn-primary btn-sm" to={total === 0 ? "/home" : "/specimens"}>{total === 0 ? "Create a record" : "Show all specimens"}</Link></section>
        ) : (
          <>
            <p className="text-xs text-base-content/60 mb-4">{matched.toLocaleString("en-US")} matching specimens · Page {page} of {pageCount}</p>
            <section className="specimen-collection-grid" aria-label="Your specimens">
              {specimens.map((specimen) => (
                <article className="specimen-collection-entry" key={specimen.id}>
                  <SpecimenCollectionCard specimen={specimen} />
                  <Form method="post" className="specimen-feature-action">
                    <input type="hidden" name="recordId" value={specimen.id} />
                    <button className={`btn btn-sm w-full ${featuredId === specimen.id ? "btn-ghost" : "btn-outline"}`} name="intent" value="feature" disabled={saving || featuredId === specimen.id}>
                      {featuredId === specimen.id ? "Featured on your profile" : "Feature on profile"}
                    </button>
                  </Form>
                </article>
              ))}
            </section>
            <nav className="flex justify-between items-center gap-3 mt-8" aria-label="Specimen pages">
              {page > 1 ? <Link className="btn btn-outline btn-sm" to={pageLink(page - 1)}>Previous</Link> : <span />}
              {page < pageCount && <Link className="btn btn-outline btn-sm" to={pageLink(page + 1)}>Next</Link>}
            </nav>
          </>
        )}
      </main>
    </div>
  );
}
