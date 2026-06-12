/**
 * Vérification HMAC de CHAQUE requête Slack.
 * Signature v0 : HMAC-SHA256(signing_secret, "v0:{timestamp}:{body}").
 * Tolérance 5 minutes anti-replay, comparaison à temps constant.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const SLACK_TIMESTAMP_TOLERANCE_S = 60 * 5;

export function verifySlackSignature(opts: {
  signingSecret: string;
  body: string;
  timestamp: string | null;
  signature: string | null;
  nowMs?: number;
}): boolean {
  const { signingSecret, body, timestamp, signature } = opts;
  if (!timestamp || !signature) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const nowS = Math.floor((opts.nowMs ?? Date.now()) / 1000);
  if (Math.abs(nowS - ts) > SLACK_TIMESTAMP_TOLERANCE_S) return false;

  const base = `v0:${timestamp}:${body}`;
  const expected = `v0=${createHmac("sha256", signingSecret).update(base).digest("hex")}`;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Lit le body brut + headers d'une Request et vérifie. Retourne le body si OK. */
export async function readVerifiedSlackBody(req: Request): Promise<string | null> {
  const body = await req.text();
  const ok = verifySlackSignature({
    signingSecret: process.env.SLACK_SIGNING_SECRET!,
    body,
    timestamp: req.headers.get("x-slack-request-timestamp"),
    signature: req.headers.get("x-slack-signature"),
  });
  return ok ? body : null;
}
