import type { Metadata, Viewport } from "next";
import { Source_Serif_4 } from "next/font/google";
import "./globals.css";

// Gros titres : serif éditorial proche de la typo des présentations Anthropic
// (Tiempos étant commerciale, Source Serif 4 est l'équivalent open le plus proche).
const displayFont = Source_Serif_4({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
  display: "swap",
});

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
    <html lang="en" className={displayFont.variable}>
      <body>{children}</body>
    </html>
  );
}
