import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";
import { ConsoleFrame } from "@/shared/ui/components/ConsoleFrame";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <ConsoleFrame>{children}</ConsoleFrame>
        </Providers>
      </body>
    </html>
  );
}
