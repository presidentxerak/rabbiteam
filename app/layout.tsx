import type { Metadata, Viewport } from "next";
// Police auto-hébergée (woff2 bundlé dans le repo) : aucune dépendance réseau
// au build, contrairement à next/font/google. Serif éditorial proche de la
// typo des présentations Anthropic (Tiempos étant commerciale).
import "@fontsource/source-serif-4/600.css";
import "@fontsource/source-serif-4/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rabbiteam - Would your team survive the Rabbit?",
  description:
    "The async social game for teams: a kawaii 3D island that grows from your real work, and every week, a secret Rabbit to unmask. 3 minutes a day, inside Slack.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://rabbiteam.app"),
  openGraph: {
    title: "Rabbiteam",
    description: "Kawaii 3D island + weekly social deduction, inside Slack.",
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
