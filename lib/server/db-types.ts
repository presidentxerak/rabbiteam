/** Projections TypeScript des lignes SQL utilisées côté serveur. */

export interface OrgRow {
  id: string;
  slack_team_id: string;
  slack_team_name: string;
  plan: "free" | "team" | "company";
  stripe_customer_id: string | null;
  locale: "fr" | "en";
}

export interface IslandRow {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  seed: number;
  slack_channel_id: string;
  timezone: string;
  is_public: boolean;
  invite_code: string;
}

export interface PlayerRow {
  id: string;
  island_id: string;
  auth_user_id: string | null;
  slack_user_id: string;
  display_name: string;
  avatar_seed: number;
  equipped: Record<string, string>;
  carrots: number;
  streak: number;
  last_standup: string | null;
  is_active: boolean;
  created_at: string;
}

export interface GameRow {
  id: string;
  island_id: string;
  week_start: string;
  status: "active" | "voting" | "revealed" | "cancelled";
  result: "rabbit_win" | "detectives_win" | "draw" | null;
}

export interface ItemRow {
  id: string;
  slug: string;
  name: string;
  slot: "head" | "face" | "neck" | "hand" | "aura" | "island";
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  params: Record<string, unknown>;
}

export interface GameMissionRow {
  id: string;
  game_id: string;
  mission_id: string;
  status: "pending" | "done" | "failed";
  proof: Record<string, unknown> | null;
  missions?: {
    slug: string;
    tool: string;
    difficulty: number;
    brief_md: string;
    detection: "auto" | "honor";
    params: Record<string, unknown>;
  };
}
