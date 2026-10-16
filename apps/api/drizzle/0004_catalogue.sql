-- The catalogue.
--
-- Scenario content is global and carries no org_id. Every learner sees the same
-- catalogue, so scoping it per tenant would mean storing four identical copies and
-- would make publishing a scenario a per-tenant operation. What is per-tenant is
-- progress, which lives in its own table at the bottom of this file and does carry
-- org_id and a policy.
--
-- Versioning is here from the start because the content gate depends on it: a scenario
-- ships only when the solve test proves it on that exact version. live_version is what a
-- learner launches; status is where the draft has reached.

create table if not exists scenarios (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  type text not null check (type in ('ad-set', 'standalone', 'exam-sim')),
  tier text not null check (tier in ('C1', 'C2', 'C3', 'C4')),
  objective text not null,
  domain text not null,
  os text not null check (os in ('windows', 'linux', 'mixed')),
  est_minutes integer not null check (est_minutes > 0),
  host_count integer not null check (host_count > 0),
  difficulty integer not null check (difficulty between 1 and 5),
  summary text not null,
  status text not null default 'draft'
    check (status in ('draft', 'in-review', 'published', 'retired')),
  live_version integer not null default 1,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists scenarios_slug_key on scenarios (slug);
-- The catalogue list is filtered on status and ordered on these, every request.
create index if not exists scenarios_status_idx on scenarios (status);
create index if not exists scenarios_published_idx on scenarios (published_at desc);

-- One row per technique rather than an array column, because the facet counts are a
-- group by over this table and an array would need unnesting on every catalogue request.
create table if not exists scenario_techniques (
  scenario_id uuid not null references scenarios (id) on delete cascade,
  technique text not null,
  primary key (scenario_id, technique)
);

create index if not exists scenario_techniques_technique_idx on scenario_techniques (technique);

create table if not exists scenario_teaches (
  scenario_id uuid not null references scenarios (id) on delete cascade,
  position integer not null,
  text text not null,
  primary key (scenario_id, position)
);

create table if not exists scenario_proof_requirements (
  scenario_id uuid not null references scenarios (id) on delete cascade,
  position integer not null,
  text text not null,
  primary key (scenario_id, position)
);

create table if not exists scenario_prerequisites (
  scenario_id uuid not null references scenarios (id) on delete cascade,
  position integer not null,
  label text not null,
  kind text not null check (kind in ('scenario', 'primer')),
  ref text not null,
  primary key (scenario_id, position)
);

-- host_key is the stable identifier the topology links refer to and the UI keys on. It
-- is scoped to the scenario, not globally unique, so two scenarios can both have a dc01.
create table if not exists scenario_hosts (
  scenario_id uuid not null references scenarios (id) on delete cascade,
  host_key text not null,
  position integer not null,
  name text not null,
  ip text not null,
  os text not null check (os in ('windows', 'linux')),
  role text not null,
  exposure text not null check (exposure in ('learner-facing', 'internal')),
  ports integer[] not null default '{}',
  proofs text[] not null default '{}',
  primary key (scenario_id, host_key)
);

create table if not exists scenario_links (
  scenario_id uuid not null references scenarios (id) on delete cascade,
  from_key text not null,
  to_key text not null,
  label text,
  primary key (scenario_id, from_key, to_key)
);

-- The credential the learner starts with. Content, not a secret: it is published in the
-- scenario brief. Per-deploy randomisation replaces it at launch, which is what stops
-- the value here from being an answer worth sharing.
create table if not exists scenario_credentials (
  scenario_id uuid primary key references scenarios (id) on delete cascade,
  username text not null,
  password text not null
);

-- Progress is per learner, inside a tenant. org_id carries the policy; user_id says
-- whose it is, so a team of three does not share one row.
create table if not exists scenario_progress (
  org_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  scenario_id uuid not null references scenarios (id) on delete cascade,
  status text not null default 'not-started'
    check (status in ('not-started', 'in-progress', 'completed')),
  attempts integer not null default 0,
  best_minutes integer,
  proofs_captured integer not null default 0,
  proofs_total integer not null default 0,
  last_attempt_at timestamptz,
  debrief_id text,
  updated_at timestamptz not null default now(),
  primary key (org_id, user_id, scenario_id)
);

create index if not exists scenario_progress_user_idx on scenario_progress (user_id);

-- Where the learner sits on the path. Self-declared and adjustable today; earned
-- progression is intended later, which is why "since" is recorded now rather than
-- inferred from an audit trail that does not exist yet.
--
-- No row means C1. A default stored at signup would have to be backfilled for every
-- account the day the rule changes, and would claim a decision the learner never made.
create table if not exists learner_tier (
  org_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  tier text not null check (tier in ('C1', 'C2', 'C3', 'C4')),
  since timestamptz not null default now(),
  primary key (org_id, user_id)
);
