import type { Metadata } from "next";
import "./globals.css";

// NOTE: fonts are loaded via <link> tags below instead of next/font/google.
// This was a deliberate workaround for the sandbox environment this was
// built in, which couldn't reach fonts.googleapis.com during `next build`.
// Next.js's own linter flags this as a real anti-pattern (fonts aren't
// guaranteed on every page, no self-hosting, more layout shift risk).
// Once deployed somewhere with real internet access, switch back to
// next/font/google (Newsreader, JetBrains_Mono, Inter) — see the git
// history / NEXTJS_PLAN.md for the exact next/font version that was
// reverted here, or just re-add three next/font imports the same way
// this file originally had them.

export const metadata: Metadata = {
  title: "Deliberate Living",
  description: "Household weekly planner",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-ink text-paper">
        {children}
      </body>
    </html>
  );
}
