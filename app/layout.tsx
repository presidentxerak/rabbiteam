import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rabbiteam — Votre équipe résisterait au Lapin ?",
  description:
    "Le jeu social asynchrone des équipes : une île 3D kawaii qui pousse avec votre vrai travail, et chaque semaine, un Lapin secret à démasquer. 3 minutes par jour, dans Slack.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://rabbiteam.app"),
  openGraph: {
    title: "Rabbiteam 🐰",
    description: "Île 3D kawaii + déduction sociale hebdomadaire, dans Slack.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#7ED6DF",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
