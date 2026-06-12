-- ============================================================
-- RABBITEAM - SETUP COMPLET EN UN FICHIER
-- Colle l'intégralité de ce fichier dans Supabase → SQL Editor → Run.
-- (Généré par npm run setup-sql : 0001_init + 0002_seed concaténés.)
-- ============================================================

-- ============================================================
-- RABBITEAM - schéma initial complet
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
-- BOT TOKENS SLACK - table dédiée, accès service-role uniquement.
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
-- RLS - Row Level Security
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
-- VIRALITÉ - vue publique + RPC anonymisée pour /i/[slug]
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
-- RPC TRANSACTIONNELLE - achat d'indice (débit carottes + unlock atomique)
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

-- ============================================================
-- SEED - catalogue d'items + banque de missions
-- ⚠️ FICHIER GÉNÉRÉ par scripts/generate-seed.ts - ne pas éditer à la main.
-- ============================================================

-- 42 items
insert into items (slug, name, slot, rarity, params, unlock_hint) values
  ('beach_hat', 'Beach hat', 'head', 'common', '{"shape":"bucket","color":"#F5E0B7","band":"#FF8C7A"}'::jsonb, 'Standup streak'),
  ('party_hat', 'Party hat', 'head', 'common', '{"shape":"cone","color":"#F6C6D8","dots":"#FFFFFF"}'::jsonb, 'Standup streak'),
  ('beret', 'Beret', 'head', 'common', '{"shape":"beret","color":"#52465E"}'::jsonb, 'Standup streak'),
  ('headphones', 'Headphones', 'head', 'uncommon', '{"shape":"headphones","color":"#7ED6DF","pad":"#52465E"}'::jsonb, '5-day streak'),
  ('propeller_cap', 'Propeller cap', 'head', 'uncommon', '{"shape":"propeller","color":"#C8E6F5","propeller":"#FF8C7A"}'::jsonb, '5-day streak'),
  ('flower_crown', 'Flower crown', 'head', 'rare', '{"shape":"flower_crown","colors":["#F6C6D8","#FFF3CF","#CDEBD3"]}'::jsonb, 'Detectives'' victory'),
  ('golden_crown', 'Golden crown', 'head', 'epic', '{"shape":"crown","color":"#F2C14E","gems":"#FF8C7A"}'::jsonb, 'Seasons-played milestone'),
  ('halo', 'Halo', 'head', 'legendary', '{"shape":"halo","color":"#FFE9A0","glow":true}'::jsonb, '??? (very rare)'),
  ('round_glasses', 'Round glasses', 'face', 'common', '{"shape":"round","color":"#52465E"}'::jsonb, 'Standup streak'),
  ('sunglasses', 'Sunglasses', 'face', 'common', '{"shape":"square","color":"#2F2A38"}'::jsonb, 'Standup streak'),
  ('heart_sunglasses', 'Heart sunglasses', 'face', 'uncommon', '{"shape":"heart","color":"#F2A9A0"}'::jsonb, '5-day streak'),
  ('dive_mask', 'Diving mask', 'face', 'uncommon', '{"shape":"dive","color":"#7ED6DF","strap":"#52465E"}'::jsonb, 'Team victory'),
  ('monocle', 'Monocle', 'face', 'rare', '{"shape":"monocle","color":"#F2C14E"}'::jsonb, 'Detectives'' victory'),
  ('pirate_patch', 'Pirate eye patch', 'face', 'rare', '{"shape":"patch","color":"#2F2A38"}'::jsonb, 'Rabbit victory'),
  ('bow_tie', 'Bow tie', 'neck', 'common', '{"shape":"bow","color":"#FF8C7A"}'::jsonb, 'Standup streak'),
  ('striped_scarf', 'Striped scarf', 'neck', 'common', '{"shape":"scarf","colors":["#C8E6F5","#FFFDF8"]}'::jsonb, 'Standup streak'),
  ('bell_collar', 'Bell collar', 'neck', 'uncommon', '{"shape":"bell","color":"#D9C7F2","bell":"#F2C14E"}'::jsonb, '5-day streak'),
  ('flower_lei', 'Flower lei', 'neck', 'uncommon', '{"shape":"lei","colors":["#F6C6D8","#FFF3CF","#CDEBD3"]}'::jsonb, 'Team victory'),
  ('pearl_necklace', 'Pearl necklace', 'neck', 'rare', '{"shape":"pearls","color":"#FFFDF8"}'::jsonb, 'Detectives'' victory'),
  ('cape', 'Cape', 'neck', 'epic', '{"shape":"cape","color":"#B79BD9","lining":"#FFF3CF"}'::jsonb, 'Seasons-played milestone'),
  ('carrot_classic', 'Classic carrot', 'hand', 'common', '{"shape":"carrot","color":"#FF8C42","leaf":"#7BC47F"}'::jsonb, 'First standup'),
  ('coffee_mug', 'Coffee mug', 'hand', 'common', '{"shape":"mug","color":"#FFFDF8","drink":"#6B4F3A"}'::jsonb, 'Standup streak'),
  ('ice_cream', 'Ice cream', 'hand', 'common', '{"shape":"icecream","scoop":"#F6C6D8","cone":"#EBD8C3"}'::jsonb, 'Standup streak'),
  ('mini_laptop', 'Mini laptop', 'hand', 'uncommon', '{"shape":"laptop","color":"#BFC9D9","screen":"#C8E6F5"}'::jsonb, '5-day streak'),
  ('beach_racket', 'Beach paddle', 'hand', 'uncommon', '{"shape":"racket","color":"#FF8C7A","grip":"#EBD8C3"}'::jsonb, 'Team victory'),
  ('magnifier', 'Detective''s magnifier', 'hand', 'rare', '{"shape":"magnifier","color":"#F2C14E","glass":"#C8E6F5"}'::jsonb, 'Detectives'' victory'),
  ('bubble_wand', 'Bubble wand', 'hand', 'rare', '{"shape":"wand","color":"#D9C7F2","bubbles":"#C8E6F5"}'::jsonb, 'Rabbit victory'),
  ('golden_carrot', 'Golden Carrot', 'hand', 'legendary', '{"shape":"carrot","color":"#F2C14E","leaf":"#FFE9A0","glow":true}'::jsonb, 'Validated referral - for the whole island 🥕✨'),
  ('sparkles', 'Sparkles', 'aura', 'common', '{"kind":"sparkles","color":"#FFF3CF","count":8}'::jsonb, 'Standup streak'),
  ('fireflies', 'Fireflies', 'aura', 'uncommon', '{"kind":"fireflies","color":"#FFE9A0","count":10}'::jsonb, '5-day streak'),
  ('petal_particles', 'Petals', 'aura', 'rare', '{"kind":"petals","color":"#F6C6D8","count":12}'::jsonb, 'Rabbit victory'),
  ('rain_cloud', 'Tiny rain cloud', 'aura', 'rare', '{"kind":"cloud","color":"#BFC9D9","drops":"#7ED6DF"}'::jsonb, '??? (funny)'),
  ('stars', 'Stars', 'aura', 'epic', '{"kind":"stars","color":"#FFE9A0","count":6}'::jsonb, 'Seasons-played milestone'),
  ('rainbow', 'Rainbow', 'aura', 'legendary', '{"kind":"rainbow","colors":["#F2A9A0","#FFE9A0","#CDEBD3","#C8E6F5","#D9C7F2"]}'::jsonb, '??? (very rare)'),
  ('house_garland', 'House garland', 'island', 'common', '{"kind":"garland","colors":["#F6C6D8","#FFF3CF","#C8E6F5"]}'::jsonb, 'Detectives'' victory'),
  ('campfire', 'Campfire', 'island', 'common', '{"kind":"campfire","flame":"#FF8C42","wood":"#6B4F3A"}'::jsonb, '4 seasons played'),
  ('giant_buoy', 'Giant buoy', 'island', 'uncommon', '{"kind":"buoy","colors":["#FF8C7A","#FFFDF8"]}'::jsonb, 'Team victory'),
  ('hammock', 'Hammock', 'island', 'uncommon', '{"kind":"hammock","color":"#CDEBD3"}'::jsonb, '12 seasons played'),
  ('pontoon', 'Pontoon', 'island', 'rare', '{"kind":"pontoon","color":"#EBD8C3"}'::jsonb, '24 seasons played'),
  ('beach_swing', 'Beach swing', 'island', 'rare', '{"kind":"swing","color":"#F5E0B7","rope":"#EBD8C3"}'::jsonb, 'Team victory'),
  ('mini_lighthouse', 'Mini lighthouse', 'island', 'epic', '{"kind":"lighthouse","colors":["#FF8C7A","#FFFDF8"],"light":"#FFE9A0"}'::jsonb, '24 seasons played'),
  ('golden_palm', 'Golden palm', 'island', 'legendary', '{"kind":"golden_palm","color":"#F2C14E"}'::jsonb, 'Validated referral 🥕✨')
on conflict (slug) do update set name = excluded.name, params = excluded.params, unlock_hint = excluded.unlock_hint;

-- 60 missions
insert into missions (slug, tool, difficulty, brief_md, detection, params) values
  ('carrot_react_3', 'slack', 1, 'React with 🥕 in **3 different threads** before Friday. Casually.', 'auto', '{"emoji":"carrot","count":3}'::jsonb),
  ('hands_react_2', 'slack', 1, 'Drop a 🙌 on **2 different colleagues'' messages**. Be generous, not suspicious.', 'auto', '{"emoji":"raised_hands","count":2}'::jsonb),
  ('gif_friday_vibes', 'slack', 1, 'Post a GIF (any one) in a public channel. Just one. Well chosen.', 'honor', '{}'::jsonb),
  ('emoji_in_status', 'slack', 1, 'Put a **vegetable** emoji in your Slack status for at least a day.', 'honor', '{}'::jsonb),
  ('thank_someone', 'slack', 1, 'Publicly thank a colleague for something specific. Sincerity is your cover.', 'honor', '{}'::jsonb),
  ('purple_heart_2', 'slack', 1, 'Leave a 💜 on **2 messages** from different people.', 'auto', '{"emoji":"purple_heart","count":2}'::jsonb),
  ('ask_question_channel', 'slack', 1, 'Ask a real question in a channel you haven''t posted in this week.', 'honor', '{}'::jsonb),
  ('morning_greeting', 'slack', 1, 'Wish the team a good day one morning, with a sun emoji. Natural.', 'honor', '{}'::jsonb),
  ('word_constellation', 'slack', 2, 'Slip the word **“constellation”** into a real Slack conversation. Without it seeming weird.', 'auto', '{"word":"constellation"}'::jsonb),
  ('word_phare', 'slack', 2, 'Drop the word **“lighthouse”** into a public channel message. Credible context required.', 'auto', '{"word":"lighthouse"}'::jsonb),
  ('word_boussole', 'slack', 2, 'Use the word **“compass”** in a team discussion. Smoothly.', 'auto', '{"word":"compass"}'::jsonb),
  ('word_marmotte', 'slack', 2, 'Place **“groundhog”** in a conversation. Yes, it''s hard. That''s the game.', 'auto', '{"word":"groundhog"}'::jsonb),
  ('three_threads_replies', 'slack', 2, 'Reply in **3 different threads** you didn''t start, on the same day.', 'auto', '{"count":3,"kind":"thread_reply"}'::jsonb),
  ('compliment_chain', 'slack', 2, 'Compliment the work of **2 colleagues** in 2 different channels, on the same day.', 'honor', '{}'::jsonb),
  ('share_useful_link', 'slack', 2, 'Share a genuinely useful link with the team (article, tool, doc), with a line of context.', 'honor', '{}'::jsonb),
  ('poll_lunch', 'slack', 2, 'Run a light mini-poll in the team channel (lunch, coffee, playlist…). Get at least 2 people to vote.', 'honor', '{}'::jsonb),
  ('emoji_streak_day', 'slack', 2, 'Drop **5 🥕 reactions** during the week, spread across at least 2 days.', 'auto', '{"emoji":"carrot","count":5}'::jsonb),
  ('revive_old_thread', 'slack', 2, 'Usefully revive a thread older than 3 days (a real revival, not a “bump”).', 'honor', '{}'::jsonb),
  ('word_perissodactyle', 'slack', 3, 'Place the word **“perissodactyl”** in a real conversation. Good luck, agent.', 'auto', '{"word":"perissodactyl"}'::jsonb),
  ('word_crepuscule_x2', 'slack', 3, 'Use **“twilight”** in **2 separate messages**, at least a day apart.', 'auto', '{"word":"twilight","count":2}'::jsonb),
  ('haiku_hidden', 'slack', 3, 'Write a message that is secretly a **haiku** (5-7-5). No one should notice before Friday.', 'honor', '{}'::jsonb),
  ('alphabet_message', 'slack', 3, 'Post a useful message whose **first 3 sentences start with A, B, C** in order.', 'honor', '{}'::jsonb),
  ('five_reactions_one_message', 'slack', 3, 'Get **5 reactions** (from 5 people) on a single one of your messages. Without asking.', 'honor', '{}'::jsonb),
  ('start_thread_10_replies', 'slack', 3, 'Start a conversation that reaches **10 replies**. Topic is free, talent is mandatory.', 'honor', '{}'::jsonb),
  ('notion_emoji_page', 'notion', 1, 'Change the icon of a Notion page you own to an **animal** emoji.', 'honor', '{}'::jsonb),
  ('notion_tidy_one', 'notion', 1, 'Tidy or cleanly rename **one** badly-titled Notion page. Quiet housekeeping is your art.', 'honor', '{}'::jsonb),
  ('notion_comment_nice', 'notion', 1, 'Leave a constructive comment on a colleague''s Notion page.', 'honor', '{}'::jsonb),
  ('notion_add_cover', 'notion', 1, 'Add a cover image to a page that doesn''t have one.', 'honor', '{}'::jsonb),
  ('notion_new_page', 'notion', 2, 'Create and publish a **new, useful Notion page** (notes, doc, process) this week.', 'auto', '{"kind":"page_created"}'::jsonb),
  ('notion_word_lagon', 'notion', 2, 'Slip the word **“lagoon”** into a Notion page or comment.', 'honor', '{"word":"lagoon"}'::jsonb),
  ('notion_checklist', 'notion', 2, 'Turn a messy paragraph (yours, or with consent) into a clean **checklist**.', 'honor', '{}'::jsonb),
  ('notion_template', 'notion', 2, 'Create a small reusable **template** for the team (meeting, report, etc.).', 'honor', '{}'::jsonb),
  ('notion_link_pages', 'notion', 2, 'Link **2 existing** Notion pages together with @page mentions. The web is woven.', 'honor', '{}'::jsonb),
  ('notion_glossary', 'notion', 3, 'Create a mini **glossary** (≥5 terms) of the team''s jargon. Someone must read it before Friday.', 'honor', '{}'::jsonb),
  ('notion_archive_sweep', 'notion', 3, 'Archive or merge **3 obsolete pages** (with consent if needed). The ghost''s big cleanup.', 'honor', '{}'::jsonb),
  ('notion_faq', 'notion', 3, 'Start a team **FAQ** with at least 3 real questions and answers.', 'honor', '{}'::jsonb),
  ('kanban_emoji_title', 'kanban', 1, 'Add a relevant emoji to the title of **one ticket** you own.', 'honor', '{}'::jsonb),
  ('kanban_clean_one', 'kanban', 1, 'Fill in the description of an empty ticket (yours). The detectives won''t see a thing.', 'honor', '{}'::jsonb),
  ('kanban_label_garden', 'kanban', 1, 'Add or fix the **labels** on 2 tickets. Board gardening.', 'honor', '{}'::jsonb),
  ('kanban_close_ticket', 'kanban', 2, 'Close **one ticket** this week (a real one, not a ticket made for the occasion).', 'auto', '{"kind":"issue_completed"}'::jsonb),
  ('kanban_split_ticket', 'kanban', 2, 'Split a big ticket into **2 clear subtasks**.', 'honor', '{}'::jsonb),
  ('kanban_estimate_sweep', 'kanban', 2, 'Estimate or re-estimate **3 tickets** in the backlog. No one the wiser.', 'honor', '{}'::jsonb),
  ('kanban_word_iceberg', 'kanban', 2, 'Place the word **“iceberg”** in a ticket description or comment.', 'honor', '{"word":"iceberg"}'::jsonb),
  ('kanban_two_closed', 'kanban', 3, 'Close **2 tickets** this week. The most productive Rabbit in the West.', 'auto', '{"kind":"issue_completed","count":2}'::jsonb),
  ('kanban_zombie_hunt', 'kanban', 3, 'Identify **3 zombie tickets** (>30 days with no activity) and propose their fate in a comment.', 'honor', '{}'::jsonb),
  ('any_compliment_tool', 'any', 1, 'Say something nice (sincerely) about a team tool in a conversation. Any tool.', 'honor', '{}'::jsonb),
  ('any_tea_coffee', 'any', 1, 'Offer a virtual or real coffee/tea to a colleague you rarely talk to.', 'honor', '{}'::jsonb),
  ('any_doc_typo', 'any', 1, 'Fix a typo somewhere (doc, ticket, wiki). The masked proofreader strikes again.', 'honor', '{}'::jsonb),
  ('any_share_win', 'any', 1, 'Share a small win of the week (yours, or a colleague''s with their consent).', 'honor', '{}'::jsonb),
  ('any_meeting_idea', 'any', 2, 'Propose **one concrete idea** in a meeting or in writing this week. Something actionable.', 'honor', '{}'::jsonb),
  ('any_help_unasked', 'any', 2, 'Help a colleague on something **without them asking** (review, proofread, troubleshooting).', 'honor', '{}'::jsonb),
  ('any_teach_trick', 'any', 2, 'Teach someone a trick (shortcut, command, tool). Knowledge spreads.', 'honor', '{}'::jsonb),
  ('any_two_tools_word', 'any', 2, 'Place the word **“archipelago”** in **2 different tools** (Slack + Notion, Slack + ticket…).', 'honor', '{"word":"archipelago"}'::jsonb),
  ('any_intro_two_people', 'any', 2, 'Connect 2 colleagues who should talk about a specific topic.', 'honor', '{}'::jsonb),
  ('any_mini_demo', 'any', 3, 'Give a **mini-demo** (≤5 min) of something you made, to at least 2 people.', 'honor', '{}'::jsonb),
  ('any_process_fix', 'any', 3, 'Spot a small process annoyance and **propose a fix** in writing. Rabbit diplomacy.', 'honor', '{}'::jsonb),
  ('any_silent_week_goal', 'any', 3, 'Set yourself a secret goal Monday, hold it all week, and reveal it Friday after the vote.', 'honor', '{}'::jsonb),
  ('any_three_kindness', 'any', 3, 'Do **3 discreet kind acts** (on 3 different days). If you''re spotted, it doesn''t count.', 'honor', '{"count":3}'::jsonb),
  ('any_lunch_organizer', 'any', 3, 'Organize a team moment (lunch, break, game) that ≥3 people join.', 'honor', '{}'::jsonb),
  ('any_doc_rescue', 'any', 3, 'Find an important piece of info that''s documented nowhere and **document it** cleanly.', 'honor', '{}'::jsonb)
on conflict (slug) do update set brief_md = excluded.brief_md, params = excluded.params;
