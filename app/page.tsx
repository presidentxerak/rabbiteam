/**
 * Marketing landing. Referral capture: /?ref=[island_id] is forwarded into
 * the Slack OAuth `state` (Golden Carrot reward at the 5-active-players gate).
 */
import LandingIsland from "@/components/LandingIsland";
import HeroRabbit from "@/components/HeroRabbit";
import MagicParticles from "@/components/MagicParticles";
import AmbientMusic from "@/components/AmbientMusic";

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

const WEEK = [
  { day: "MON", time: "9:00", title: "Season opens", body: "One active player is secretly drawn as The Rabbit and DM'd 3 missions (one easy, one medium, one hard) to slip into Slack, Notion or your tickets. Everyone else just sees “Season #N is open — the Rabbit is among you.”" },
  { day: "DAILY", time: "9:30", title: "Standup", body: "A single non-spammy reminder. Post your intention in 30 seconds, earn 10 carrots (+ a streak bonus), and items drop at 3, 5 and every 10 days. People who already posted aren't pinged." },
  { day: "TUE", time: "10:00", title: "Free clue #1", body: "A deliberately broad clue, generated from the Rabbit's public profile (avatar traits, name, seniority). The engine guarantees it still leaves at least 3 suspects — no one is fingered on day one." },
  { day: "WED", time: "10:00", title: "Paid clue #2", body: "Sharper (leaves at least 2 suspects), unlocked individually for 30 carrots via /rabbiteam unlock. Whoever pays can bluff about what they learned — that social friction is the whole point." },
  { day: "THU", time: "15:00", title: "Free clue #3 + recap", body: "The last free clue lands, plus a reminder that tomorrow is the vote. This is when the channel lights up." },
  { day: "FRI", time: "11:00", title: "Voting opens", body: "Cast your vote in a Slack modal (changeable until 4pm). On the 3D island the rabbits gather in front of the house, in real time — you see who voted, never for whom." },
  { day: "FRI", time: "16:00", title: "Voting closes & scoring", body: "The majority suspect is computed. A tie means no unmasking. The result is locked but kept secret for 30 more minutes." },
  { day: "FRI", time: "16:30", title: "The reveal", body: "A dramatic 3-message Slack sequence, a spotlight and falling mask on the 3D island, the shareable Reveal Card, and the loot. Votes and missions become public — fuel for the after-party." },
];

export default async function LandingPage({ searchParams }: { searchParams: SearchParams }) {
  const { ref, installed, error } = await searchParams;
  const installUrl = slackInstallUrl(ref);

  return (
    <main className="landing">
      <LandingIsland />
      <MagicParticles />
      <AmbientMusic />

      <header className="hero">
        <div className="hackathon-badge">Anthropic × Motier — Hackathon</div>

        <HeroRabbit />

        <span className="tag">For teams of 5 to 50 people</span>
        <h1>
          Your team has an island.
          <br />
          And an impostor.
        </h1>
        <p className="sub">
          Rabbiteam turns your week into a game: a kawaii 3D island that grows from your team&apos;s
          real work, a 30-second standup that pays in carrots, and every Monday, a teammate secretly
          named <strong>The Rabbit</strong>. Can you unmask them by Friday?
        </p>
        {installed && (
          <p className="tag" style={{ background: "#cdebd3" }}>
            Installed! Type `/rabbiteam setup #channel` in Slack to get started.
          </p>
        )}
        {error && (
          <p className="tag" style={{ background: "#ffd9d4" }}>
            Installation failed, please try again.
          </p>
        )}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a className="btn btn-primary" href={installUrl}>
            Add to Slack
          </a>
          <a className="btn btn-ghost" href="#how">
            How does it work?
          </a>
        </div>
        {ref && (
          <p style={{ marginTop: 16, color: "var(--ink-soft)" }}>
            You arrived through a referral: at 5 active players, your island and your referrer&apos;s
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
            <h3>Ambient — daily, zero effort</h3>
            <p>
              Slack messages, Notion pages, finished tickets: every real signal grows a flower, a
              lantern, a seashell on your 3D island. 100% collective cosmetics —{" "}
              <strong>never</strong> an individual performance ranking.
            </p>
          </div>
          <div className="card">
            <span className="step-num">2</span>
            <h3>Ritual — daily, 30 seconds</h3>
            <p>
              Each morning, drop your intention of the day and a mood. You earn carrots, your streak
              climbs, and rare items unlock. Your rabbit has never been this well dressed.
            </p>
          </div>
          <div className="card">
            <span className="step-num">3</span>
            <h3>Event — weekly, The Rabbit Season</h3>
            <p>
              Every Monday one player secretly becomes <strong>The Rabbit</strong> with 3 discreet
              missions to slip into your real tools. Clues Tuesday, Wednesday (paid in carrots) and
              Thursday. Vote Friday 11am. Dramatic reveal on the island at 4:30pm.
            </p>
          </div>
        </div>
      </section>

      {/* ===== A week with the Rabbit (full walkthrough) ===== */}
      <section className="week">
        <h2 style={{ textAlign: "center", fontSize: 32 }}>A week with the Rabbit, hour by hour</h2>
        <p className="sub" style={{ margin: "8px auto 28px", textAlign: "center" }}>
          Everything happens in Slack on your island&apos;s timezone. One automatic dispatcher runs
          the whole show — nothing for you to schedule.
        </p>
        <div className="timeline">
          {WEEK.map((s, i) => (
            <div key={i} className="tl-row">
              <div className="tl-when">
                <span className="tl-day">{s.day}</span>
                <span className="tl-time">{s.time}</span>
              </div>
              <div className="tl-dot" />
              <div className="tl-card">
                <strong>{s.title}</strong>
                <p>{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="scoring">
          <h3 style={{ textAlign: "center" }}>How the season is scored</h3>
          <div className="scoring-grid">
            <div className="card">
              <h4>Detectives win</h4>
              <p>The majority vote correctly names the Rabbit. The team gets a rare item and the island grows a magnifier monument.</p>
            </div>
            <div className="card">
              <h4>The Rabbit wins</h4>
              <p>It escapes the vote <strong>and</strong> completed at least 2 of its 3 missions. A rabbit statue rises on the island.</p>
            </div>
            <div className="card">
              <h4>Draw</h4>
              <p>It escapes but hid too much (fewer than 2 missions). No loot — the anti-passivity rule that stops the Rabbit from simply doing nothing.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="card">
          <h3>Secret guarded by the database</h3>
          <p>
            The Rabbit&apos;s identity is protected at the database level (Row Level Security): even a
            curious developer with the console open sees nothing. The suspense is technical.
          </p>
        </div>
        <div className="card">
          <h3>3 minutes a day, max</h3>
          <p>
            The game lives in Slack. The 3D island is the stage, not a chore. No extra meetings, no
            notification overload, no report to fill in.
          </p>
        </div>
        <div className="card">
          <h3>A 100% in-game economy</h3>
          <p>
            No buying items with money. Everything is earned: streaks, victories, seasons played,
            referrals. The Golden Carrot has to be deserved.
          </p>
        </div>
      </section>

      {/* ===== Built on the agent loop (hackathon theme) ===== */}
      <section className="agentloop">
        <h2 style={{ textAlign: "center", fontSize: 32 }}>Built on the agent loop</h2>
        <p className="sub" style={{ margin: "8px auto 28px", textAlign: "center" }}>
          Rabbiteam maps cleanly onto the four primitives of the Claude Agent SDK — and adds two
          real Claude agents on top.
        </p>
        <div className="primitives">
          <div className="card">
            <span className="prim-tag">Agent</span>
            <h3>The Game Master</h3>
            <p>The hourly dispatcher runs the season: picks the Rabbit, deals missions, releases clues, scores the vote — and Claude narrates each clue in the team&apos;s voice.</p>
          </div>
          <div className="card">
            <span className="prim-tag">Environment</span>
            <h3>Slack and the island</h3>
            <p>The team&apos;s real tools are the workspace: Slack messages, Notion pages, finished tickets — all feeding the 3D island the agents act on.</p>
          </div>
          <div className="card">
            <span className="prim-tag">Session</span>
            <h3>The Rabbit Season</h3>
            <p>Each week is one stateful run, Monday 9am to Friday&apos;s reveal, with its own secret, missions, clues and votes.</p>
          </div>
          <div className="card">
            <span className="prim-tag">Events</span>
            <h3>Standups, kudos, webhooks</h3>
            <p>Every real signal is an event that grows the island and drives the loop — no polling, one cron, cost near zero.</p>
          </div>
        </div>
        <div className="card agent-highlight">
          <h3>Detective Agent — and it literally can&apos;t cheat</h3>
          <p>
            Type <code>/rabbiteam detective who has lop ears?</code> and a Claude agent investigates
            with you — reading the published clues, the roster, and the public 3D avatar traits via
            tool use, then narrowing the suspects. Its tools <strong>physically cannot</strong> read
            the Rabbit&apos;s identity: that&apos;s guarded by Postgres Row-Level Security, not by a
            prompt. Even the AI can&apos;t spoil the secret.
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
            <h3>Team</h3>
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

      {/* ===== FAQ ===== */}
      <section className="faq">
        <h2 style={{ textAlign: "center", fontSize: 32 }}>Good questions</h2>
        <div className="faq-grid">
          <div className="card">
            <h4>Is my work being tracked or ranked?</h4>
            <p>
              No — and that&apos;s a hard rule. Real signals (messages, pages, finished tickets) only
              ever feed <strong>collective cosmetics</strong> on the shared island. There is no
              individual productivity metric, anywhere, ever. Kanban signals are aggregated per team,
              never per person.
            </p>
          </div>
          <div className="card">
            <h4>How is the Rabbit&apos;s identity protected?</h4>
            <p>
              By Postgres, not by our front-end. The secret lives in a table with Row-Level Security
              and <strong>no read policy at all</strong> — even an authenticated member crafting a
              raw query gets zero rows. Missions stay invisible until the reveal, so you can&apos;t
              just watch who&apos;s doing what.
            </p>
          </div>
          <div className="card">
            <h4>How much time does it take?</h4>
            <p>
              Under 3 minutes a day. The game lives in Slack; the 3D island is the stage you visit
              when you want, not a chore. One 30-second standup, the odd clue, a Friday vote.
            </p>
          </div>
          <div className="card">
            <h4>What do we need to install?</h4>
            <p>
              Just the Slack app — “Add to Slack”, then <code>/rabbiteam setup #channel</code>. Every
              member gets a magic link in DM and discovers their unique rabbit. Notion and Kanban are
              optional extras.
            </p>
          </div>
          <div className="card">
            <h4>Can the AI Detective spoil the secret?</h4>
            <p>
              No. The Detective Agent reasons over published clues and public avatar traits via tool
              use, but its tools <strong>cannot read the secret table</strong> — the same RLS wall
              applies to it. Even the AI plays fair.
            </p>
          </div>
          <div className="card">
            <h4>What does it cost to run?</h4>
            <p>
              Almost nothing. Everything is event-driven — a single hourly dispatcher computes each
              island&apos;s local time and acts only when something is due. No always-on servers,
              cost near zero.
            </p>
          </div>
        </div>
      </section>

      <footer style={{ textAlign: "center", marginTop: 72, color: "var(--ink-soft)" }}>
        <a className="btn btn-primary" href={installUrl}>
          Add to Slack
        </a>
        <p style={{ marginTop: 24 }}>
          Rabbiteam — the Rabbit is among you. · No individual metrics, ever.
        </p>
        <p style={{ fontSize: 13 }}>Built for the Anthropic × Motier Hackathon.</p>
      </footer>
    </main>
  );
}
