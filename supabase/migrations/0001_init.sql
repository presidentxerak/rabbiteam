-- ============================================================
-- RABBITEAM — schéma initial complet
-- Philosophie RLS : le client web (anon key + session) ne peut
-- voir QUE son île, et JAMAIS le secret du Lapin. Toute écriture
-- de jeu passe par le serveur (service role, bypasse RLS).
-- Le client n'écrit que : son vote, son équipement, ses achats
-- d'indices, son standup.
-- ============================================================

-- ============ EXTENSIONS ============
create extension if not exists pgcrypto;

-- ============ ORGANISATIONS & ÎLES ============
create table organizations (
  id                 uuid primary key default gen_random_uuid(),
  slack_team_id      text unique not null,
  slack_team_name    text not null,
  plan               text not null default 'free' check (plan in ('free','team','company')),
  stripe_customer_id text,
  notion_workspace_id text,
  locale             text not null default 'fr' check (locale in ('fr','en')),
  created_at         timestamptz not null default now()
);

-- Le bot token Slack est stocké dans Supabase Vault, PAS en clair.
-- Accès uniquement via les fonctions store_slack_token / get_slack_token
-- (security definer, exécutables par le service role seulement).

create table islands (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations(id) on delete cascade,
  name             text not null,
  slug             text unique not null,
  seed             bigint not null,                  -- génération procédurale de l'île
  slack_channel_id text not null,                    -- canal #rabbiteam de l'équipe
  linear_team_id   text,
  timezone         text not null default 'Europe/Paris',
  is_public        boolean not null default true,    -- lien /i/[slug] actif
  invite_code      text unique not null default encode(gen_random_bytes(6),'hex'),
  created_at       timestamptz not null default now()
);
create index idx_islands_org on islands(org_id);

-- ============ JOUEURS ============
create table players (
  id             uuid primary key default gen_random_uuid(),
  island_id      uuid not null references islands(id) on delete cascade,
  auth_user_id   uuid references auth.users(id),     -- lié au 1er login web (lien magique)
  slack_user_id  text not null,
  display_name   text not null,
  avatar_seed    bigint not null,                    -- LE lapin (calculé client)
  equipped       jsonb not null default '{}',        -- {"head":"flower_crown", ...}
  carrots        integer not null default 0 check (carrots >= 0),
  streak         integer not null default 0,
  last_standup   date,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (island_id, slack_user_id)
);
create index idx_players_island on players(island_id);
create index idx_players_auth on players(auth_user_id);

-- ============ CATALOGUE & INVENTAIRE ============
create table items (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  slot        text not null check (slot in ('head','face','neck','hand','aura','island')),
  rarity      text not null check (rarity in ('common','uncommon','rare','epic','legendary')),
  params      jsonb not null default '{}',           -- couleurs, dimensions, ancrage
  unlock_hint text                                   -- affiché dans la collection
);

create table player_items (
  player_id  uuid not null references players(id) on delete cascade,
  item_id    uuid not null references items(id),
  source     text not null,                          -- 'streak_5','rabbit_win','referral',...
  earned_at  timestamptz not null default now(),
  primary key (player_id, item_id)
);

create table island_items (                           -- items de slot 'island', collectifs
  island_id uuid not null references islands(id) on delete cascade,
  item_id   uuid not null references items(id),
  earned_at timestamptz not null default now(),
  primary key (island_id, item_id)
);

-- ============ ÉVÉNEMENTS (source de vérité de la croissance de l'île) ============
create table island_events (
  id              bigint generated always as identity primary key,
  island_id       uuid not null references islands(id) on delete cascade,
  type            text not null,                     -- 'standup','kudo','sprint_done','notion_page','season_rabbit_win','season_detective_win','member_joined','referral'
  actor_player_id uuid references players(id) on delete set null,
  payload         jsonb not null default '{}',
  created_at      timestamptz not null default now()
);
create index idx_events_island_time on island_events(island_id, created_at);

-- ============ SAISONS (parties hebdomadaires) ============
create table games (
  id          uuid primary key default gen_random_uuid(),
  island_id   uuid not null references islands(id) on delete cascade,
  week_start  date not null,                         -- le lundi
  status      text not null default 'active'
              check (status in ('active','voting','revealed','cancelled')),
  result      text check (result in ('rabbit_win','detectives_win','draw')),
  created_at  timestamptz not null default now(),
  unique (island_id, week_start)
);

-- 🔒 LE SECRET : table séparée, AUCUNE policy de lecture → invisible même authentifié.
create table game_secrets (
  game_id          uuid primary key references games(id) on delete cascade,
  rabbit_player_id uuid not null references players(id)
);

-- ============ MISSIONS ============
create table missions (                               -- banque éditoriale (~60)
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  tool        text not null check (tool in ('slack','notion','kanban','any')),
  difficulty  integer not null check (difficulty between 1 and 3),
  brief_md    text not null,                          -- consigne envoyée en DM au Lapin
  detection   text not null check (detection in ('auto','honor')),
  params      jsonb not null default '{}'             -- ex: {"emoji":"🥕","count":3}
);

create table game_missions (
  id           uuid primary key default gen_random_uuid(),
  game_id      uuid not null references games(id) on delete cascade,
  mission_id   uuid not null references missions(id),
  status       text not null default 'pending' check (status in ('pending','done','failed')),
  proof        jsonb,
  completed_at timestamptz,
  unique (game_id, mission_id)
);

-- ============ INDICES ============
create table clues (
  game_id     uuid not null references games(id) on delete cascade,
  ordinal     integer not null,                       -- 1..4 dans la semaine
  content     text not null,
  tier        text not null check (tier in ('free','paid')),
  price       integer not null default 0,
  revealed_at timestamptz,                            -- null = pas encore public
  primary key (game_id, ordinal)
);

create table clue_unlocks (                           -- achats individuels d'indices payants
  game_id    uuid not null,
  ordinal    integer not null,
  player_id  uuid not null references players(id) on delete cascade,
  paid       integer not null,
  created_at timestamptz not null default now(),
  primary key (game_id, ordinal, player_id),
  foreign key (game_id, ordinal) references clues(game_id, ordinal) on delete cascade
);

-- ============ VOTES ============
create table votes (
  game_id    uuid not null references games(id) on delete cascade,
  voter_id   uuid not null references players(id) on delete cascade,
  suspect_id uuid not null references players(id),
  created_at timestamptz not null default now(),
  primary key (game_id, voter_id)                     -- un vote par joueur, modifiable
);

-- ============ STANDUPS ============
create table standups (
  player_id  uuid not null references players(id) on delete cascade,
  island_id  uuid not null references islands(id) on delete cascade,
  day        date not null,
  intention  text not null check (char_length(intention) <= 140),
  mood       text not null default '🙂',
  created_at timestamptz not null default now(),
  primary key (player_id, day)
);
create index idx_standups_island_day on standups(island_id, day);

-- ============ PARRAINAGES ============
create table referrals (
  id                 uuid primary key default gen_random_uuid(),
  referrer_island_id uuid not null references islands(id) on delete cascade,
  referred_org_id    uuid unique references organizations(id),
  status             text not null default 'pending'
                     check (status in ('pending','activated','rewarded')),
  created_at         timestamptz not null default now()
);

-- ============ IDEMPOTENCE (serveur uniquement, aucune policy) ============
-- Un cron peut être rejoué, un webhook Slack relivré : rien ne doit se
-- produire deux fois. Chaque action loggue ici AVANT d'agir (insert ... on
-- conflict do nothing ; si 0 ligne insérée → déjà fait → on s'arrête).
create table dispatch_log (
  island_id  uuid not null references islands(id) on delete cascade,
  action     text not null,
  day        date not null,
  created_at timestamptz not null default now(),
  primary key (island_id, action, day)
);

create table slack_events_processed (
  event_id   text primary key,
  created_at timestamptz not null default now()
);

-- ================================================================
-- BOT TOKENS SLACK — table dédiée, accès service-role uniquement.
-- (RLS activée + AUCUNE policy = invisible côté client, même garantie que
-- game_secrets. Aucune dépendance Supabase Vault : la migration s'applique
-- proprement sur tout projet.)
-- ================================================================
create table slack_tokens (
  org_id     uuid primary key references organizations(id) on delete cascade,
  bot_token  text not null,
  updated_at timestamptz not null default now()
);

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

-- ================================================================
-- RLS — Row Level Security
-- ================================================================
alter table organizations          enable row level security;
alter table islands                enable row level security;
alter table players                enable row level security;
alter table items                  enable row level security;
alter table player_items           enable row level security;
alter table island_items           enable row level security;
alter table island_events          enable row level security;
alter table games                  enable row level security;
alter table game_secrets           enable row level security;  -- 🔒 aucune policy = aucun accès client
alter table missions               enable row level security;  -- aucune policy : banque invisible (recoupement = fuite)
alter table game_missions          enable row level security;
alter table clues                  enable row level security;
alter table clue_unlocks           enable row level security;
alter table votes                  enable row level security;
alter table standups               enable row level security;
alter table referrals              enable row level security;  -- serveur uniquement
alter table dispatch_log           enable row level security;  -- serveur uniquement
alter table slack_events_processed enable row level security;  -- serveur uniquement
alter table slack_tokens           enable row level security;  -- 🔒 aucune policy = service role only

-- Helper : suis-je membre de cette île ? (SECURITY DEFINER pour éviter la récursion RLS)
create or replace function is_island_member(p_island uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from players
    where island_id = p_island and auth_user_id = auth.uid() and is_active
  );
$$;

create or replace function my_player_id(p_island uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select id from players
  where island_id = p_island and auth_user_id = auth.uid() limit 1;
$$;

-- Îles : membres en lecture ; lecture publique du strict minimum via vue (plus bas)
create policy islands_member_read on islands
  for select using (is_island_member(id));

-- Joueurs : visibles entre membres de la même île ; chacun ne modifie que son équipement
create policy players_member_read on players
  for select using (is_island_member(island_id));
create policy players_self_update on players
  for update using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Le client ne touche JAMAIS à la monnaie : carottes et streaks ne bougent
-- que côté serveur (service role → auth.uid() null → trigger transparent).
create or replace function guard_player_columns() returns trigger
language plpgsql security definer as $$
begin
  if auth.uid() is not null and (
     new.carrots is distinct from old.carrots
     or new.streak is distinct from old.streak
     or new.avatar_seed is distinct from old.avatar_seed
     or new.island_id is distinct from old.island_id
     or new.slack_user_id is distinct from old.slack_user_id
     or new.is_active is distinct from old.is_active) then
    raise exception 'column protected';
  end if;
  return new;
end $$;
create trigger trg_guard_player before update on players
  for each row execute function guard_player_columns();

-- Catalogue d'items : lecture pour tout utilisateur connecté
create policy items_read on items for select using (auth.uid() is not null);

-- Inventaires : lecture entre membres (on voit les lapins des autres équipés)
create policy player_items_read on player_items for select using (
  exists (select 1 from players p where p.id = player_id and is_island_member(p.island_id))
);
create policy island_items_read on island_items
  for select using (is_island_member(island_id));

-- Événements d'île : lecture membres (nécessaire pour reconstruire l'île)
create policy events_member_read on island_events
  for select using (is_island_member(island_id));

-- Parties : lecture membres. INSERT/UPDATE : serveur uniquement.
create policy games_member_read on games
  for select using (is_island_member(island_id));

-- Missions de partie : lisibles UNIQUEMENT après révélation (sinon fuite d'identité)
create policy game_missions_after_reveal on game_missions for select using (
  exists (select 1 from games g
          where g.id = game_id and g.status = 'revealed'
            and is_island_member(g.island_id))
);

-- Indices : lisibles si publiés (revealed_at) OU achetés par moi
create policy clues_read on clues for select using (
  exists (select 1 from games g where g.id = game_id and is_island_member(g.island_id))
  and (
    revealed_at is not null
    or exists (select 1 from clue_unlocks cu
               where cu.game_id = clues.game_id and cu.ordinal = clues.ordinal
                 and cu.player_id = my_player_id(
                   (select island_id from games where id = clues.game_id)))
  )
);
create policy clue_unlocks_self on clue_unlocks for all using (
  player_id = my_player_id((select island_id from games g where g.id = clue_unlocks.game_id))
) with check (
  player_id = my_player_id((select island_id from games g where g.id = clue_unlocks.game_id))
);

-- Votes : j'insère/modifie MON vote pendant la fenêtre 'voting', pour un
-- suspect de MON île ; je ne lis QUE mon vote avant révélation, tout après.
create policy votes_insert_own on votes for insert with check (
  voter_id = my_player_id((select island_id from games g where g.id = game_id))
  and exists (select 1 from games g where g.id = game_id and g.status = 'voting')
  and exists (select 1 from players s join games g on g.id = game_id
              where s.id = suspect_id and s.island_id = g.island_id and s.is_active)
);
create policy votes_update_own on votes for update using (
  voter_id = my_player_id((select island_id from games g where g.id = game_id))
  and exists (select 1 from games g where g.id = game_id and g.status = 'voting')
) with check (
  voter_id = my_player_id((select island_id from games g where g.id = game_id))
  and exists (select 1 from players s join games g on g.id = game_id
              where s.id = suspect_id and s.island_id = g.island_id and s.is_active)
);
create policy votes_read on votes for select using (
  voter_id = my_player_id((select island_id from games g where g.id = game_id))
  or exists (select 1 from games g
             where g.id = game_id and g.status = 'revealed'
               and is_island_member(g.island_id))
);

-- Standups : insert le mien (jour courant), lecture entre membres
create policy standups_insert_own on standups for insert with check (
  player_id = my_player_id(island_id) and day = current_date
);
create policy standups_read on standups
  for select using (is_island_member(island_id));

-- ================================================================
-- VIRALITÉ — vue publique + RPC anonymisée pour /i/[slug]
-- (RGPD-safe : aucun nom, aucun contenu de message)
-- ================================================================
create or replace view public_islands
with (security_invoker = off) as
  select i.slug, i.name, i.seed,
         (select count(*) from players p where p.island_id = i.id and p.is_active) as population,
         (select count(*) from games g where g.island_id = i.id and g.status='revealed') as seasons_played
  from islands i where i.is_public;
grant select on public_islands to anon, authenticated;

-- RPC publique : événements anonymisés d'une île publique (pour le rendu 3D)
create or replace function public_island_events(p_slug text)
returns table(id bigint, type text, created_at timestamptz, payload jsonb)
language sql security definer stable set search_path = public as $$
  select e.id, e.type, e.created_at,
         e.payload - 'author' - 'text' - 'names'      -- on retire tout nominatif
  from island_events e
  join islands i on i.id = e.island_id
  where i.slug = p_slug and i.is_public
  order by e.created_at limit 1000;
$$;
grant execute on function public_island_events(text) to anon, authenticated;

-- RPC : seeds anonymes des lapins d'une île publique (lapins sans noms)
create or replace function public_island_rabbits(p_slug text)
returns table(avatar_seed bigint, equipped jsonb)
language sql security definer stable set search_path = public as $$
  select p.avatar_seed, p.equipped
  from players p join islands i on i.id = p.island_id
  where i.slug = p_slug and i.is_public and p.is_active
  limit 100;
$$;
grant execute on function public_island_rabbits(text) to anon, authenticated;

-- ================================================================
-- RPC TRANSACTIONNELLE — achat d'indice (débit carottes + unlock atomique)
-- Appelée par l'utilisateur authentifié ; SECURITY DEFINER car le débit de
-- carottes est une opération serveur (le trigger guard bloque l'update direct).
-- ================================================================
create or replace function unlock_clue(p_game_id uuid, p_ordinal integer)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_island uuid;
  v_player uuid;
  v_price integer;
  v_carrots integer;
begin
  select island_id into v_island from games where id = p_game_id;
  if v_island is null then return json_build_object('ok', false, 'error', 'game_not_found'); end if;

  select id, carrots into v_player, v_carrots from players
  where island_id = v_island and auth_user_id = auth.uid() and is_active;
  if v_player is null then return json_build_object('ok', false, 'error', 'not_a_member'); end if;

  select price into v_price from clues
  where game_id = p_game_id and ordinal = p_ordinal and tier = 'paid';
  if v_price is null then return json_build_object('ok', false, 'error', 'clue_not_found'); end if;

  if exists (select 1 from clue_unlocks
             where game_id = p_game_id and ordinal = p_ordinal and player_id = v_player) then
    return json_build_object('ok', true, 'already', true);
  end if;

  if v_carrots < v_price then
    return json_build_object('ok', false, 'error', 'not_enough_carrots', 'needed', v_price, 'have', v_carrots);
  end if;

  update players set carrots = carrots - v_price where id = v_player;
  insert into clue_unlocks (game_id, ordinal, player_id, paid)
  values (p_game_id, p_ordinal, v_player, v_price);
  return json_build_object('ok', true, 'paid', v_price);
end $$;
grant execute on function unlock_clue(uuid, integer) to authenticated;
revoke execute on function unlock_clue(uuid, integer) from anon;
