/**
 * Client Slack Web API minimal en HTTP brut (pas de Bolt : serverless).
 * Chaque appel est un fetch POST JSON avec le bot token de l'organisation.
 */
import "server-only";

const SLACK_API = "https://slack.com/api";

export interface SlackApiResult {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

export async function slackApi(
  token: string,
  method: string,
  payload: Record<string, unknown>,
): Promise<SlackApiResult> {
  const res = await fetch(`${SLACK_API}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as SlackApiResult;
  if (!json.ok) {
    console.error(`[slack] ${method} failed:`, json.error);
  }
  return json;
}

export async function postMessage(
  token: string,
  channel: string,
  text: string,
  blocks?: unknown[],
): Promise<SlackApiResult> {
  return slackApi(token, "chat.postMessage", { channel, text, ...(blocks ? { blocks } : {}) });
}

export async function postEphemeral(
  token: string,
  channel: string,
  user: string,
  text: string,
  blocks?: unknown[],
): Promise<SlackApiResult> {
  return slackApi(token, "chat.postEphemeral", {
    channel,
    user,
    text,
    ...(blocks ? { blocks } : {}),
  });
}

/** Ouvre (ou retrouve) le DM avec un utilisateur et poste un message. */
export async function postDM(
  token: string,
  slackUserId: string,
  text: string,
  blocks?: unknown[],
): Promise<SlackApiResult> {
  const open = await slackApi(token, "conversations.open", { users: slackUserId });
  const channelId = (open.channel as { id?: string } | undefined)?.id;
  if (!open.ok || !channelId) return open;
  return postMessage(token, channelId, text, blocks);
}

/** Message programmé (utilisé pour espacer la séquence de révélation). */
export async function scheduleMessage(
  token: string,
  channel: string,
  postAtEpochS: number,
  text: string,
  blocks?: unknown[],
): Promise<SlackApiResult> {
  return slackApi(token, "chat.scheduleMessage", {
    channel,
    post_at: postAtEpochS,
    text,
    ...(blocks ? { blocks } : {}),
  });
}

export async function openModal(
  token: string,
  triggerId: string,
  view: Record<string, unknown>,
): Promise<SlackApiResult> {
  return slackApi(token, "views.open", { trigger_id: triggerId, view });
}

export async function getChannelMembers(token: string, channel: string): Promise<string[]> {
  const members: string[] = [];
  let cursor: string | undefined;
  do {
    const res = await slackApi(token, "conversations.members", {
      channel,
      limit: 200,
      ...(cursor ? { cursor } : {}),
    });
    if (!res.ok) break;
    members.push(...((res.members as string[] | undefined) ?? []));
    cursor = (res.response_metadata as { next_cursor?: string } | undefined)?.next_cursor || undefined;
  } while (cursor);
  return members;
}

export async function getUserInfo(
  token: string,
  userId: string,
): Promise<{ name: string; isBot: boolean } | null> {
  const res = await slackApi(token, "users.info", { user: userId });
  if (!res.ok) return null;
  const user = res.user as
    | { real_name?: string; name?: string; is_bot?: boolean; profile?: { display_name?: string } }
    | undefined;
  if (!user) return null;
  return {
    name: user.profile?.display_name || user.real_name || user.name || "Lapin anonyme",
    isBot: Boolean(user.is_bot),
  };
}
