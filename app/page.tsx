/**
 * Marketing landing. Referral capture: /?ref=[island_id] is forwarded into
 * the Slack OAuth `state` (Golden Carrot reward at the 5-active-players gate).
 */
import LandingIsland from "@/components/LandingIsland";
import HeroRabbit from "@/components/HeroRabbit";

type SearchParams = Promise<{ ref?: string; installed?: string; error?: string }>;

function slackInstallUrl(ref?: string): string {
  const scopes = [
    "chat:write",
    "commands",
    "users:read",
    "channels:read",
    "reactions:read",
    "im:write",
    "chat:write.public",
  ].join(",");
  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID ?? "",
    scope: scopes,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://rabbiteam.app"}/api/slack/oauth`,
  });
  if (ref) params.set("state", `ref_${ref}`);
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export default async function LandingPage({ searchParams }: { searchParams: SearchParams }) {
  const { ref, installed, error } = await searchParams;
  const installUrl = slackInstallUrl(ref);

  return (
    <main className="landing">
      <LandingIsland />

      <header className="hero">
        <div className="hackathon-badge">🏆 Anthropic × Motier — Hackathon</div>

        <HeroRabbit />

        <span className="tag">🐰 For teams of 5 to 50 people</span>
        <h1>
          Your team has an island.
          <br />
          And an impostor. 🏝️
        </h1>
        <p className="sub">
          Rabbiteam turns your week into a game: a kawaii 3D island that grows from your team&apos;s
          real work, a 30-second standup that pays in carrots, and every Monday… a teammate secretly
          named <strong>The Rabbit</strong>. Can you unmask them by Friday?
        </p>
        {installed && (
          <p className="tag" style={{ background: "#cdebd3" }}>
            ✅ Installed! Type `/rabbiteam setup #channel` in Slack to get started.
          </p>
        )}
        {error && (
          <p className="tag" style={{ background: "#ffd9d4" }}>
            ⚠️ Installation failed, please try again.
          </p>
        )}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a className="btn btn-primary" href={installUrl}>
            Add to Slack 🥕
          </a>
          <a className="btn btn-ghost" href="#how">
            How does it work?
          </a>
        </div>
        {ref && (
          <p style={{ marginTop: 16, color: "var(--ink-soft)" }}>
            🥕✨ You arrived through a referral: at 5 active players, your island AND your referrer&apos;s
            both receive the legendary Golden Carrot.
          </p>
        )}
      </header>

      {/* ===== How it works ===== */}
      <section id="how" className="how">
        <h2 style={{ textAlign: "center", fontSize: 32 }}>Three layers, one loop</h2>
        <div className="how-steps">
          <div className="card">
            <span className="step-num">1</span>
            <h3>🏝️ Ambient — daily, zero effort</h3>
            <p>
              Slack messages, Notion pages, finished tickets: every real signal grows a flower, a
              lantern, a seashell on your 3D island. 100% collective cosmetics —{" "}
              <strong>never</strong> an individual performance ranking.
            </p>
          </div>
          <div className="card">
            <span className="step-num">2</span>
            <h3>🥕 Ritual — daily, 30 seconds</h3>
            <p>
              Each morning, drop your intention of the day and a mood. You earn carrots, your streak
              climbs, and rare items unlock. Your rabbit has never been this well dressed.
            </p>
          </div>
          <div className="card">
            <span className="step-num">3</span>
            <h3>🕵️ Event — weekly, The Rabbit Season</h3>
            <p>
              Every Monday one player secretly becomes <strong>The Rabbit</strong> with 3 discreet
              missions to slip into your real tools. Clues Tuesday, Wednesday (paid in carrots 😏) and
              Thursday. Vote Friday 11am. Dramatic reveal on the island at 4:30pm.
            </p>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="card">
          <h3>🔒 Secret guarded by the database</h3>
          <p>
            The Rabbit&apos;s identity is protected at the database level (Row Level Security): even a
            curious developer with the console open sees nothing. The suspense is technical.
          </p>
        </div>
        <div className="card">
          <h3>⚡ 3 minutes a day, max</h3>
          <p>
            The game lives in Slack. The 3D island is the stage, not a chore. No extra meetings, no
            notification overload, no report to fill in.
          </p>
        </div>
        <div className="card">
          <h3>🎁 A 100% in-game economy</h3>
          <p>
            No buying items with money. Everything is earned: streaks, victories, seasons played,
            referrals. The Golden Carrot has to be deserved.
          </p>
        </div>
      </section>

      {/* ===== Pricing (hidden for now, kept in code) ===== */}
      <section id="pricing" hidden style={{ display: "none" }}>
        <h2 style={{ textAlign: "center", fontSize: 32 }}>One price per island, not per head</h2>
        <div className="pricing">
          <div className="card">
            <h3>Free</h3>
            <div className="price">
              €0 <small>forever</small>
            </div>
            <ul>
              <li>1 island, 8 players max</li>
              <li>1 Rabbit Season / month</li>
              <li>90-day island history</li>
              <li>Slack only</li>
            </ul>
          </div>
          <div className="card" style={{ border: "3px solid var(--coral)" }}>
            <h3>Team 🥕</h3>
            <div className="price">
              €29 <small>/ month / island</small>
            </div>
            <ul>
              <li>Unlimited players</li>
              <li>A season every week</li>
              <li>Permanent history</li>
              <li>Notion + Kanban</li>
              <li>Seasonal items</li>
            </ul>
          </div>
          <div className="card">
            <h3>Company</h3>
            <div className="price">
              €199 <small>/ month</small>
            </div>
            <ul>
              <li>Unlimited islands</li>
              <li>Cross-team archipelago (v2)</li>
              <li>SSO, central admin</li>
            </ul>
          </div>
        </div>
      </section>

      <footer style={{ textAlign: "center", marginTop: 72, color: "var(--ink-soft)" }}>
        <a className="btn btn-primary" href={installUrl}>
          Add to Slack 🥕
        </a>
        <p style={{ marginTop: 24 }}>
          Rabbiteam — the Rabbit is among you. · No individual metrics, ever.
        </p>
        <p style={{ fontSize: 13 }}>Built for the Anthropic × Motier Hackathon.</p>
      </footer>
    </main>
  );
}
