-- Identity and organisations. Mirrors src/db/schema/identity.ts.
--
-- Written by hand rather than generated: drizzle-kit cannot be hoisted into this
-- workspace without dragging a react-native peer into the frontend tree, and an
-- explicit reviewed migration is worth more here than a generated one.

create extension if not exists "pgcrypto";

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  public_id text not null,
  name text not null,
  personal boolean not null default true,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists organizations_public_id_key on organizations (public_id);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  public_id text not null,
  email text not null,
  email_verified_at timestamptz,
  pending_email text,
  name text not null,
  handle text,
  country text,
  avatar_url text,
  created_at timestamptz not null default now(),
  last_active_at timestamptz,
  deletion_scheduled_for timestamptz
);
create unique index if not exists users_email_key on users (email);
create unique index if not exists users_handle_key on users (handle);
create unique index if not exists users_public_id_key on users (public_id);

create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  role text not null default 'learner',
  created_at timestamptz not null default now()
);
create unique index if not exists memberships_org_user_key on memberships (org_id, user_id);
create index if not exists memberships_user_idx on memberships (user_id);

create table if not exists credentials (
  user_id uuid primary key references users (id) on delete cascade,
  password_hash text not null,
  changed_at timestamptz not null default now()
);

create table if not exists oauth_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  provider text not null,
  provider_account_id text not null,
  account_label text,
  linked_at timestamptz not null default now()
);
create unique index if not exists oauth_provider_account_key
  on oauth_accounts (provider, provider_account_id);
create index if not exists oauth_user_idx on oauth_accounts (user_id);

create table if not exists totp_secrets (
  user_id uuid primary key references users (id) on delete cascade,
  secret text not null,
  enabled_at timestamptz
);

create table if not exists recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  code_hash text not null,
  used_at timestamptz
);
create index if not exists recovery_codes_user_idx on recovery_codes (user_id);

create table if not exists auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  token_hash text not null,
  device text,
  kind text,
  location text,
  ip text,
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  expires_at timestamptz not null,
  impersonated_by uuid references users (id)
);
create unique index if not exists auth_sessions_token_key on auth_sessions (token_hash);
create index if not exists auth_sessions_user_idx on auth_sessions (user_id);

create table if not exists email_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  purpose text not null,
  token_hash text not null,
  email text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz
);
create unique index if not exists email_tokens_token_key on email_tokens (token_hash);
create index if not exists email_tokens_user_purpose_idx on email_tokens (user_id, purpose);

create table if not exists login_attempts (
  identifier text primary key,
  failures integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
