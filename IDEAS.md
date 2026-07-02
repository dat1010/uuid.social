# Ideas for uuid.social

This document collects exploratory product ideas for uuid.social before any schema,
route, or UI work begins. The goal is to keep experiments aligned with the
current UUID-auth model, D1 storage, records, bounties, and connection graph.

## Current Architecture Anchors

- UUID-only auth: account UUIDs are secret credentials, never public profile IDs.
- Storage: Cloudflare D1 via Drizzle tables for users, sessions, records, bounties,
  bounty claims, UUID objects, connections, follows, and admins.
- Public objects: records, bounties, claims, and connections have UUID-addressed
  pages or graph presence; account credentials do not.
- Routes: public landing, login/signup, home timeline, profiles, bounties,
  specimens, record pages, claim/bounty/connection pages, and graph views.
- Product limits: records and replies are short, immutable except soft deletion,
  and profile fields are intentionally compact.

## Prioritization Framework

Use these criteria when turning an idea into a scoped implementation ticket:

1. **Vision fit**: strengthens the "experimental social network made of UUIDs"
   premise rather than copying a full conventional social app.
2. **Effort vs. value**: provides visible value with the fewest schema, route, and
   moderation changes.
3. **Dependencies**: can stand alone or clearly identifies prerequisite features.
4. **Privacy risk**: avoids exposing account UUIDs, sensitive linkage, or recovery
   assumptions that conflict with the UUID-only security model.
5. **Reversibility**: can be disabled, hidden, or soft-deleted if the experiment is
   confusing or attracts abuse.

Complexity estimates: **Small** = UI/query only or one narrow table; **Medium** =
one new workflow plus migrations; **Large** = multiple workflows, moderation, or
background processing.

## Social Primitives

### Typed follows
- Description: Let users follow people, records, or graph objects for reasons like
  "reading", "watching", or "collaborating".
- UUID-auth alignment: Follows attach to public user IDs or UUID objects, never to
  secret login UUIDs.
- Schema changes: Extend `follows` with a follow type or add a `follow_targets`
  table for non-user objects.
- UI surface area: Enhance profile and object pages with follow controls and add a
  filtered home feed.
- Complexity: Medium.

### Relationship annotations
- Description: Allow connection creators to add a short note explaining why one
  UUID object supports, disputes, corrects, or references another.
- UUID-auth alignment: Notes are attached to public connection UUIDs and authored
  by the signed-in user who created the connection.
- Schema changes: Add optional `note` and edited timestamp fields to `connections`
  or create a versioned `connection_notes` table.
- UI surface area: Enhance connection pages, graph tooltips, and relationship
  lists.
- Complexity: Medium.

### Local trust signals
- Description: Show "trusted by people you follow" hints without creating a global
  trust score.
- UUID-auth alignment: Signals are derived from public follow and connection data,
  preserving pseudonymity and avoiding secret credential exposure.
- Schema changes: None initially; derived query over follows/connections. A cache
  table could be added later if performance requires it.
- UI surface area: Profile pages, record cards, and graph sidebars.
- Complexity: Medium.

## Content Features

### Thread summaries
- Description: Add concise human-authored summaries to long record threads so a
  reader can understand context before opening every reply.
- UUID-auth alignment: Summaries are records or metadata authored by public users,
  not tied to account credentials.
- Schema changes: Add a `thread_summaries` table or model summaries as a special
  record relationship.
- UI surface area: Record pages and home timeline cards for active discussions.
- Complexity: Medium.

### Media attachments for records
- Description: Let a record include one image or small media attachment stored in
  R2 with strict size and type limits.
- UUID-auth alignment: Attachment ownership follows the public record and account
  user ID; no account UUIDs appear in object keys or URLs.
- Schema changes: Add `record_attachments` with record ID, R2 key, MIME type,
  dimensions, and moderation state.
- UI surface area: Composer, record cards, record pages, and admin review.
- Complexity: Large.

### Collaborative records
- Description: Allow multiple users to co-sign or co-maintain a public record that
  represents a shared artifact.
- UUID-auth alignment: Collaborators are public user IDs; invitations use session
  auth, never raw UUID credentials.
- Schema changes: Add `record_collaborators` and possibly `record_revisions`.
- UI surface area: Composer options, record pages, profile activity, and admin
  tooling for disputes.
- Complexity: Large.

## Discovery

### User-authored tags
- Description: Let users tag records, bounties, or connections with compact labels
  that make browsing easier.
- UUID-auth alignment: Tags are public annotations by signed-in users and attach to
  public UUID objects.
- Schema changes: Add `tags` and `object_tags`, or represent tags as typed
  connections to tag objects.
- UI surface area: Object pages, tag landing pages, composer suggestions, and
  search filters.
- Complexity: Medium.

### Graph-aware search
- Description: Search by UUID, username, record text, and relationship type, then
  rank results by graph proximity to the current user or object.
- UUID-auth alignment: Search indexes public data only; account UUID hashes and
  session data remain excluded.
- Schema changes: Add an FTS table for records and public profile fields; optional
  denormalized graph metrics table.
- UI surface area: Header search, `/search`, and graph page search controls.
- Complexity: Large.

### Trending specimens
- Description: Highlight unusual records, bounties, or connection patterns that
  are gaining replies, claims, or graph links.
- UUID-auth alignment: Trends derive from public event counts and avoid personal
  data aggregation beyond public activity.
- Schema changes: Initially none; later add daily aggregate tables if live queries
  are too expensive.
- UI surface area: Landing page module, home sidebar, and specimens page.
- Complexity: Medium.

## Gamification

### Reputation without identity creep
- Description: Experiment with bounded reputation badges for useful connections,
  bounty wins, and helpful replies instead of a single global score.
- UUID-auth alignment: Reputation is tied to public usernames and can be reset by
  abandoning an account, matching the no-recovery model.
- Schema changes: Add `reputation_events` or compute from existing bounties,
  follows, replies, and connection creators.
- UI surface area: Profiles, record cards, bounty pages, and admin audit screens.
- Complexity: Medium.

### Achievement badges
- Description: Award visible badges for first record, first bounty win, graph
  explorer milestones, and careful profile completion.
- UUID-auth alignment: Badges attach to public user IDs and should avoid implying
  real-world identity verification.
- Schema changes: Add `badges` and `user_badges` with awarded timestamps.
- UI surface area: Profile pages, home sidebar, and optional landing page examples.
- Complexity: Small to Medium.

### Bounty streaks
- Description: Show daily or weekly participation streaks for bounty attempts and
  wins.
- UUID-auth alignment: Streaks use public bounty claim records and signed-in user
  IDs, not secret credentials.
- Schema changes: Add cached streak fields or compute from `bounty_claims`.
- UI surface area: Bounties page, profile trophies, and home teaser.
- Complexity: Small.

## Privacy and Control

### Granular visibility
- Description: Let users keep some records out of the global timeline while still
  sharing direct UUID permalinks.
- UUID-auth alignment: Visibility affects public record distribution, not account
  credential secrecy.
- Schema changes: Add a `visibility` field to records and indexes for timeline
  queries.
- UI surface area: Composer, record page labels, profile filters, and home query.
- Complexity: Medium.

### Ephemeral records
- Description: Records that expire from timelines after a chosen period while
  keeping an audit trail for deletion and moderation.
- UUID-auth alignment: Expiration is public-record metadata; raw account UUIDs
  remain untouched.
- Schema changes: Add `expires_at` and lifecycle indexes to records.
- UI surface area: Composer option, record badges, timeline filtering, and admin
  review.
- Complexity: Medium.

### Data export
- Description: Provide a downloadable archive of a user's profile, records,
  replies, connections, follows, and bounty claims.
- UUID-auth alignment: Export requires an active session and never includes the raw
  login UUID because the service does not store it.
- Schema changes: None initially; may need export job metadata for large accounts.
- UI surface area: Profile/settings page and one protected export route.
- Complexity: Medium.

## Monetization

### Tips for records and bounties
- Description: Let users send small appreciation tips to record authors or bounty
  winners through an external payment provider.
- UUID-auth alignment: Payments must be linked to public user IDs and provider
  accounts, never to account UUID credentials.
- Schema changes: Add payment account links, tip events, and payout status tables.
- UI surface area: Record pages, bounty pages, profiles, and settings.
- Complexity: Large.

### Sponsored bounties
- Description: Allow a user or sponsor to fund a bounty with clear disclosure and
  simple moderation controls.
- UUID-auth alignment: Sponsors are public users or externally labeled entities;
  claiming still depends on normal authenticated sessions.
- Schema changes: Extend bounties with sponsor metadata, funding state, and claim
  payout state.
- UI surface area: Bounty creation flow, bounty pages, admin review, and public
  sponsor labels.
- Complexity: Large.

### Premium profile experiments
- Description: Offer optional profile cosmetics, custom graph themes, or expanded
  profile fields without changing core posting.
- UUID-auth alignment: Entitlements attach to public user IDs and must not create
  account recovery expectations.
- Schema changes: Add `user_entitlements` and possibly billing tables.
- UI surface area: Profile editor, graph view, and settings.
- Complexity: Medium to Large.

## Developer Tools

### Public object API
- Description: Expose read-only JSON endpoints for public records, bounties,
  connections, and graph neighborhoods.
- UUID-auth alignment: API responses must include only public object UUIDs and
  public profile identifiers.
- Schema changes: None for a read-only version; add API token tables only for
  authenticated write APIs.
- UI surface area: Documentation page and stable endpoint routes.
- Complexity: Medium.

### Webhooks for graph events
- Description: Notify subscribed tools when public records, replies, bounty claims,
  or connections are created.
- UUID-auth alignment: Payloads include public UUID objects and usernames only.
- Schema changes: Add webhook subscriptions, delivery attempts, and signing
  secrets.
- UI surface area: Developer settings and admin delivery inspection.
- Complexity: Large.

### Embeddable widgets
- Description: Provide copy-paste widgets for a record, profile, bounty, or small
  graph neighborhood.
- UUID-auth alignment: Widgets render public data and should not require sessions.
- Schema changes: None for static embeds; optional cache table for rendered cards.
- UI surface area: Share controls on public pages and a small widget script route.
- Complexity: Medium.

## Next Steps for Any Chosen Idea

1. Create a specific GitHub issue for the selected idea with success criteria.
2. Design schema migrations and data retention rules, if storage changes are
   needed.
3. Write a technical spec listing file-level changes, routes, queries, services,
   and tests.
4. Implement the smallest end-to-end slice with focused tests and migration
   review.
5. Revisit this document after learning from usage or team discussion.
