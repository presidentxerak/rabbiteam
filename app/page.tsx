/**
 * Landing marketing. Capture du parrainage : /?ref=[island_id] est reporté
 * dans le `state` OAuth Slack (récompense Carotte Dorée au seuil de 5 joueurs).
 */
import LandingIsland from "@/components/LandingIsland";

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
        <span className="tag">🐰 Pour les équipes de 5 à 50 personnes</span>
        <h1>
          Votre équipe a une île.
          <br />
          Et un imposteur. 🏝️
        </h1>
        <p className="sub">
          Rabbiteam transforme votre semaine en jeu : une île 3D kawaii qui pousse avec votre vrai
          travail, un standup de 30 secondes qui rapporte des carottes, et chaque lundi… un
          collègue secrètement désigné <strong>Le Lapin</strong>. Saurez-vous le démasquer vendredi ?
        </p>
        {installed && (
          <p className="tag" style={{ background: "#cdebd3" }}>
            ✅ Installé ! Tapez `/rabbiteam setup #canal` dans Slack pour commencer.
          </p>
        )}
        {error && (
          <p className="tag" style={{ background: "#ffd9d4" }}>
            ⚠️ L&apos;installation a échoué, réessayez.
          </p>
        )}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a className="btn btn-primary" href={installUrl}>
            Ajouter à Slack 🥕
          </a>
          <a className="btn btn-ghost" href="#how">
            Comment ça marche ?
          </a>
        </div>
        {ref && (
          <p style={{ marginTop: 16, color: "var(--ink-soft)" }}>
            🥕✨ Vous arrivez via un parrainage : à 5 joueurs actifs, votre île ET celle de vos
            parrains reçoivent la Carotte Dorée legendary.
          </p>
        )}
      </header>

      <section id="how" className="features">
        <div className="card">
          <h3>🏝️ L&apos;île qui pousse toute seule</h3>
          <p>
            Messages Slack, pages Notion, tickets terminés : chaque signal réel fait pousser une
            fleur, une lanterne, un coquillage. Zéro effort, 100% cosmétique collectif —{" "}
            <strong>jamais</strong> de classement de performance individuelle.
          </p>
        </div>
        <div className="card">
          <h3>🥕 Le standup qui rapporte</h3>
          <p>
            Chaque matin, 30 secondes : votre intention du jour, votre humeur. Vous gagnez des
            carottes, votre streak grimpe, des items rares tombent. Votre lapin n&apos;a jamais été
            aussi bien habillé.
          </p>
        </div>
        <div className="card">
          <h3>🕵️ La Saison du Lapin</h3>
          <p>
            Chaque lundi, un joueur reçoit en secret 3 missions à glisser dans vos vrais outils.
            Indices mardi, mercredi (payant en carottes 😏) et jeudi. Vote vendredi 11h. Révélation
            dramatique sur l&apos;île à 16h30.
          </p>
        </div>
        <div className="card">
          <h3>🔒 Secret garanti par la base</h3>
          <p>
            L&apos;identité du Lapin est protégée au niveau base de données (Row Level Security) :
            même un développeur curieux avec la console ouverte ne voit rien. Le suspense est
            technique.
          </p>
        </div>
        <div className="card">
          <h3>⚡ 3 minutes par jour, max</h3>
          <p>
            Le jeu vit dans Slack. L&apos;île 3D est la scène, pas l&apos;obligation. Aucune réunion
            en plus, aucune notification de trop, aucun rapport à remplir.
          </p>
        </div>
        <div className="card">
          <h3>🎁 Une économie 100% jeu</h3>
          <p>
            Aucun achat d&apos;items en euros. Tout se gagne : streaks, victoires, saisons jouées,
            parrainages. La Carotte Dorée se mérite.
          </p>
        </div>
      </section>

      <section id="pricing">
        <h2 style={{ textAlign: "center", fontSize: 32 }}>Un prix par île, pas par tête</h2>
        <div className="pricing">
          <div className="card">
            <h3>Free</h3>
            <div className="price">
              0 € <small>pour toujours</small>
            </div>
            <ul>
              <li>1 île, 8 joueurs max</li>
              <li>1 Saison du Lapin / mois</li>
              <li>Historique d&apos;île 90 jours</li>
              <li>Slack uniquement</li>
            </ul>
          </div>
          <div className="card" style={{ border: "3px solid var(--coral)" }}>
            <h3>Team 🥕</h3>
            <div className="price">
              29 € <small>/ mois / île</small>
            </div>
            <ul>
              <li>Joueurs illimités</li>
              <li>Saison chaque semaine</li>
              <li>Historique permanent</li>
              <li>Notion + Kanban</li>
              <li>Items saisonniers</li>
            </ul>
          </div>
          <div className="card">
            <h3>Company</h3>
            <div className="price">
              199 € <small>/ mois</small>
            </div>
            <ul>
              <li>Îles illimitées</li>
              <li>Archipel inter-équipes (v2)</li>
              <li>SSO, admin centralisé</li>
            </ul>
          </div>
        </div>
      </section>

      <footer style={{ textAlign: "center", marginTop: 72, color: "var(--ink-soft)" }}>
        <a className="btn btn-primary" href={installUrl}>
          Ajouter à Slack 🥕
        </a>
        <p style={{ marginTop: 24 }}>
          Rabbiteam — le Lapin est parmi vous. · Aucune métrique individuelle, jamais.
        </p>
      </footer>
    </main>
  );
}
