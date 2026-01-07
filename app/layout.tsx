import type { Metadata } from "next";
import "./globals.css";
import { WizardProvider } from "@/contexts";

export const metadata: Metadata = {
  title: "Snap Caddy - Custom Gridfinity Bins",
  description: "Generate custom 3D-printable Gridfinity bins from photos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <WizardProvider>{children}</WizardProvider>
      </body>
    </html>
  );
}
