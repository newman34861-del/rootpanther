-- Settings that belong to the person rather than to the organisation.
--
-- Deliberately not org-scoped. A learner who later joins a team keeps their own help
-- level, terminal size and SSH key; those are not the team's to hold. Both tables are
-- therefore keyed on the user and carry no org_id, which is also why the tenancy guard
-- does not expect a policy on them.
--
-- The check constraints repeat what the Zod contracts already say. That repetition is
-- the point: a bug that skips validation writes nothing, rather than writing a value
-- every reader then has to defend against.

create table if not exists user_preferences (
  user_id uuid primary key references users (id) on delete cascade,
  help_default text not null default 'nudge'
    check (help_default in ('exam-sim', 'shadow', 'nudge', 'coach', 'teach', 'walkthrough')),
  terminal_font_size integer not null default 14
    check (terminal_font_size between 10 and 22),
  terminal_theme text not null default 'deep-space'
    check (terminal_theme in ('deep-space', 'high-contrast', 'paper')),
  email_session_expiry boolean not null default true,
  email_debrief_ready boolean not null default true,
  email_new_scenarios boolean not null default false,
  email_billing boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists lab_defaults (
  user_id uuid primary key references users (id) on delete cascade,
  connection text not null default 'openvpn'
    check (connection in ('browser', 'openvpn')),
  teardown text not null default 'idle'
    check (teardown in ('idle', 'leave', 'max-life')),
  ssh_key text,
  updated_at timestamptz not null default now()
);

-- Handles are compared case-insensitively, so two accounts cannot differ only in case.
-- The unique index on users.handle alone would allow "dana" and "Dana" to coexist and
-- then disagree about which profile a URL points at.
create unique index if not exists users_handle_lower_key on users (lower(handle));
