import type { Metadata } from "next";
import { AppProviders } from "./providers";
import PwaRegistration from "./PwaRegistration";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReMind | Cognitive support with care",
  description: "Cognitive activities, reminders, and doctor-reviewed progress support.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <AppProviders>
          <PwaRegistration />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
