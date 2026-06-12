-- ============================================================
-- 0003 — Stockage du bot token Slack SANS Supabase Vault.
--
-- Pourquoi : l'API Vault (vault.create_secret / update_secret) varie selon
-- les versions de Supabase et peut faire échouer l'installation Slack à
-- l'exécution. On la remplace par une table dédiée, accessible UNIQUEMENT
-- par le service role : RLS activée + AUCUNE policy = invisible côté client,
-- exactement comme game_secrets. Le token n'est jamais exposé au navigateur.
--
-- Les fonctions store_slack_token / get_slack_token gardent la même signature
-- (les appels lib/supabase/admin.ts ne changent pas) ; create or replace
-- remplace simplement le corps Vault de 0001 par une lecture/écriture de table.
-- ============================================================

create table if not exists slack_tokens (
  org_id     uuid primary key references organizations(id) on delete cascade,
  bot_token  text not null,
  updated_at timestamptz not null default now()
);

alter table slack_tokens enable row level security;
-- Aucune policy : seul le service role (qui bypasse RLS) lit/écrit ce token.

create or replace function store_slack_token(p_org_id uuid, p_token text)
returns void language sql security definer set search_path = public as $$
  insert into slack_tokens (org_id, bot_token, updated_at)
  values (p_org_id, p_token, now())
  on conflict (org_id) do update
    set bot_token = excluded.bot_token, updated_at = now();
$$;

create or replace function get_slack_token(p_org_id uuid)
returns text language sql security definer stable set search_path = public as $$
  select bot_token from slack_tokens where org_id = p_org_id;
$$;

revoke execute on function store_slack_token(uuid, text) from public, anon, authenticated;
revoke execute on function get_slack_token(uuid) from public, anon, authenticated;
grant execute on function store_slack_token(uuid, text) to service_role;
grant execute on function get_slack_token(uuid) to service_role;
