-- Which organisation a session is acting in.
--
-- Named active_org_id rather than org_id on purpose. The row is owned by the user, not
-- by the organisation: this column says which tenant the session is working in, which is
-- a different statement from "this row belongs to that tenant". The tenancy guard looks
-- for org_id and would otherwise demand a policy on the one table that has to be
-- readable before any policy can be evaluated, since resolving the session is what
-- produces the value the policies compare against.
--
-- Nullable because sessions issued before this column existed have no answer. They are
-- resolved on next use rather than guessed at here.
alter table auth_sessions
  add column if not exists active_org_id uuid references organizations (id) on delete cascade;

create index if not exists auth_sessions_active_org_idx on auth_sessions (active_org_id);
