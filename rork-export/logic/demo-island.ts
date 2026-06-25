/**
 * Données de l'île de démonstration, partagées par le fond de landing
 * (LandingIsland) et la page interactive /demo. Aucune donnée réelle —
 * 100% procédural à partir d'un seed fixe.
 */
import type { IslandEventLite } from "./island-builder";

export const DEMO_SEED = "rabbiteam-demo-island";
export const DEMO_ISLAND_ITEMS = ["house_garland", "campfire", "giant_buoy"];

export function demoIslandEvents(): IslandEventLite[] {
  const types = ["standup", "kudo", "notion_page", "sprint_done", "member_joined"];
  const events: IslandEventLite[] = Array.from({ length: 90 }).map((_, i) => ({
    id: `demo-${i}`,
    type: types[i % types.length] ?? "standup",
  }));
  events.push({ id: "demo-rw", type: "season_rabbit_win" });
  events.push({ id: "demo-dw", type: "season_detective_win" });
  return events;
}

export interface DemoRabbit {
  name: string;
  avatarSeed: string;
  equipped: Record<string, string>;
}

export const DEMO_RABBITS: DemoRabbit[] = [
  { name: "Margaux", avatarSeed: "demo-rabbit-1", equipped: { head: "beach_hat" } },
  { name: "Théo", avatarSeed: "demo-rabbit-2", equipped: { hand: "carrot_classic" } },
  { name: "Léa", avatarSeed: "demo-rabbit-3", equipped: { face: "heart_sunglasses" } },
  { name: "Sam", avatarSeed: "demo-rabbit-4", equipped: { neck: "flower_lei" } },
  { name: "Inès", avatarSeed: "demo-rabbit-5", equipped: { head: "flower_crown", hand: "coffee_mug" } },
  { name: "Noah", avatarSeed: "demo-rabbit-6", equipped: { aura: "fireflies" } },
];
