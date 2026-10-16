-- Tenancy enforcement. Applied after the generated table DDL.
--
-- Two properties matter here and both are tested in CI:
--   1. A query without app.org_id set returns nothing, rather than everything.
--   2. The role the API connects as cannot turn row-level security off.
--
-- The API therefore never relies on remembering to add "where org_id = ...". If a
-- developer forgets, the result is an empty list, not another tenant's data.

create or replace function app_current_org() returns uuid
language sql stable as $$
  select nullif(current_setting('app.org_id', true), '')::uuid
$$;

create or replace function app_cross_org() returns boolean
language sql stable as $$
  select coalesce(current_setting('app.cross_org', true), 'off') = 'on'
$$;

-- Resolves which organisations a user belongs to, for the one moment when that cannot
-- be read through a policy: a request arrives with a session cookie and nothing has set
-- app.org_id yet, because the value it needs is the answer to this question.
--
-- security definer, and deliberately narrow. It takes a user id and returns only
-- organisation ids, so the worst it can do for a caller holding somebody else's user id
-- is name the organisations that user is in. Everything downstream still goes through
-- the policies, scoped to whichever of these the session was issued for.
create or replace function app_orgs_for_user(p_user uuid)
returns table (org_id uuid, role text)
language sql stable security definer set search_path = public as $$
  select m.org_id, m.role
    from memberships m
   where m.user_id = p_user
   order by m.created_at
$$;

revoke all on function app_orgs_for_user(uuid) from public;

-- Organisation-scoped tables. Every table added later that carries org_id must be
-- registered here; the orphan check below fails the build if one is missed.
do $$
declare t text;
begin
  foreach t in array array['memberships', 'scenario_progress', 'learner_tier']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists org_isolation on %I', t);
    execute format($p$
      create policy org_isolation on %I
        using (org_id = app_current_org() or app_cross_org())
        with check (org_id = app_current_org())
    $p$, t);
  end loop;
end $$;

-- An organisation row is visible to its own members, and writable only in its own scope.
alter table organizations enable row level security;
alter table organizations force row level security;
drop policy if exists org_self on organizations;
create policy org_self on organizations
  using (id = app_current_org() or app_cross_org())
  with check (id = app_current_org());

-- The application role. Deliberately not the table owner and not a superuser, because
-- both bypass row-level security regardless of policy.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'rootpanther_api') then
    create role rootpanther_api nologin;
  end if;
end $$;

grant usage on schema public to rootpanther_api;
grant select, insert, update, delete on all tables in schema public to rootpanther_api;
grant usage, select on all sequences in schema public to rootpanther_api;
alter default privileges in schema public
  grant select, insert, update, delete on tables to rootpanther_api;
alter default privileges in schema public
  grant usage, select on sequences to rootpanther_api;

-- Granted by name rather than through a blanket grant on all functions, so that adding
-- another security definer function later is a decision rather than an inheritance.
grant execute on function app_orgs_for_user(uuid) to rootpanther_api;

-- Stated explicitly rather than relied on as a default, because this one attribute
-- would silently disable every policy above.
alter role rootpanther_api nobypassrls;

-- Guard against a new org-scoped table shipping without a policy.
do $$
declare missing text;
begin
  select string_agg(c.relname, ', ') into missing
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attname = 'org_id' and a.attnum > 0
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity;
  if missing is not null then
    raise exception 'tables carry org_id without row level security: %', missing;
  end if;
end $$;
