import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGate } from "@/components/AuthGate";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Gharpayy Core AI — Execution Infrastructure" },
      {
        name: "description",
        content:
          "Central operating intelligence: attendance, performance, conversion and revenue, enforced in real time.",
      },
      { name: "author", content: "Gharpayy" },
      { property: "og:title", content: "Gharpayy Core AI — Execution Infrastructure" },
      {
        property: "og:description",
        content:
          "Central operating intelligence: attendance, performance, conversion and revenue, enforced in real time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Gharpayy Core AI — Execution Infrastructure" },
      {
        name: "twitter:description",
        content:
          "Central operating intelligence: attendance, performance, conversion and revenue, enforced in real time.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/cd4cf4fc-0be6-4e33-82a2-8a3a1e1c4d72/id-preview-24a8964b--06c5aae7-25c7-4c1a-ba96-2a01213743a2.lovable.app-1777481645627.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/cd4cf4fc-0be6-4e33-82a2-8a3a1e1c4d72/id-preview-24a8964b--06c5aae7-25c7-4c1a-ba96-2a01213743a2.lovable.app-1777481645627.png",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <AuthGate />
      <Toaster richColors position="top-right" />
    </AuthProvider>
  );
}
