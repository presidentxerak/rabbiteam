/**
 * TOUS les schémas d'entrée externe. Règle transverse : aucune donnée
 * non validée n'entre dans le moteur. Chaque handler parse ici d'abord.
 */
import { z } from "zod";

// ============ Slack — slash commands (application/x-www-form-urlencoded) ============

export const slackCommandSchema = z.object({
  command: z.string(),
  text: z.string().default(""),
  user_id: z.string().min(1),
  team_id: z.string().min(1),
  channel_id: z.string().min(1),
  trigger_id: z.string().min(1),
  response_url: z.string().url(),
});
export type SlackCommand = z.infer<typeof slackCommandSchema>;

// ============ Slack — Events API ============

export const slackUrlVerificationSchema = z.object({
  type: z.literal("url_verification"),
  challenge: z.string(),
});

export const slackMessageEventSchema = z.object({
  type: z.literal("message"),
  user: z.string().optional(),
  text: z.string().optional(),
  channel: z.string(),
  ts: z.string(),
  thread_ts: z.string().optional(),
  subtype: z.string().optional(),
  bot_id: z.string().optional(),
});

export const slackReactionEventSchema = z.object({
  type: z.literal("reaction_added"),
  user: z.string(),
  reaction: z.string(),
  item: z.object({
    type: z.string(),
    channel: z.string().optional(),
    ts: z.string().optional(),
  }),
  item_user: z.string().optional(),
  event_ts: z.string(),
});

export const slackEventCallbackSchema = z.object({
  type: z.literal("event_callback"),
  team_id: z.string(),
  event_id: z.string(),
  // Le type précis de l'événement est re-parsé dans le handler selon `type`.
  event: z.looseObject({ type: z.string() }),
});

export const slackEventEnvelopeSchema = z.union([
  slackUrlVerificationSchema,
  slackEventCallbackSchema,
]);

export type SlackMessageEvent = z.infer<typeof slackMessageEventSchema>;
export type SlackReactionEvent = z.infer<typeof slackReactionEventSchema>;

// ============ Slack — interactions (boutons, modals) ============

export const slackInteractionSchema = z.object({
  type: z.enum(["block_actions", "view_submission", "view_closed"]),
  user: z.object({ id: z.string() }),
  team: z.object({ id: z.string() }).optional().nullable(),
  trigger_id: z.string().optional(),
  view: z
    .object({
      callback_id: z.string().optional(),
      private_metadata: z.string().optional(),
      state: z
        .object({
          values: z.record(z.string(), z.record(z.string(), z.unknown())),
        })
        .optional(),
    })
    .optional(),
  actions: z
    .array(
      z.object({
        action_id: z.string(),
        value: z.string().optional(),
        selected_option: z
          .object({ value: z.string() })
          .optional()
          .nullable(),
      }),
    )
    .optional(),
  channel: z.object({ id: z.string() }).optional(),
  response_url: z.string().optional(),
});
export type SlackInteraction = z.infer<typeof slackInteractionSchema>;

// ============ Slack — OAuth callback ============

export const slackOAuthQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().optional(),
});

export const slackOAuthAccessSchema = z.object({
  ok: z.literal(true),
  access_token: z.string(),
  team: z.object({ id: z.string(), name: z.string() }),
  bot_user_id: z.string().optional(),
  authed_user: z.object({ id: z.string() }).optional(),
});

// ============ Standup (soumission de modal) ============

export const standupSubmissionSchema = z.object({
  intention: z.string().min(1).max(140),
  mood: z.enum(["🙂", "🚀", "😴", "🤯", "🎉"]).default("🙂"),
});

// ============ Vote ============

export const voteSubmissionSchema = z.object({
  gameId: z.string().uuid(),
  suspectPlayerId: z.string().uuid(),
});

// ============ Achat d'indice ============

export const clueUnlockSchema = z.object({
  gameId: z.string().uuid(),
  ordinal: z.number().int().min(1).max(4),
});

// ============ Cron dispatcher ============

export const cronQuerySchema = z.object({
  // Permet de simuler une date pour les tests d'intégration (jamais en prod
  // sans CRON_SECRET : la route est protégée par le header Authorization).
  now: z.iso.datetime().optional(),
  island: z.string().uuid().optional(),
});

// ============ Webhook Notion ============

export const notionWebhookSchema = z.object({
  type: z.string(),
  workspace_id: z.string().optional(),
  entity: z.object({ id: z.string(), type: z.string() }).optional(),
  data: z.unknown().optional(),
});

// ============ Webhook Linear (Kanban) ============

export const linearWebhookSchema = z.object({
  action: z.string(),
  type: z.string(),
  data: z
    .object({
      id: z.string(),
      teamId: z.string().optional(),
      completedAt: z.string().optional().nullable(),
    })
    .loose()
    .optional(),
});

// ============ Onboarding /join ============

export const joinQuerySchema = z.object({
  u: z.string().min(1), // slack_user_id
});

// ============ Équipement d'items (action serveur) ============

export const equipSchema = z.object({
  islandId: z.string().uuid(),
  slot: z.enum(["head", "face", "neck", "hand", "aura"]),
  itemSlug: z.string().nullable(), // null = déséquiper
});
