import type { Metadata } from "next";
import { Suspense } from "react";
import { InteractionFeedback } from "@/components/InteractionFeedback";
import "./globals.css";

export const metadata: Metadata = {
  title: "Charlotte AI",
  description: "Short reading challenges, daily wins, and classroom momentum."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('charlotte-theme');if(t==='dark'){document.documentElement.dataset.theme='dark';}}catch(e){}"
          }}
        />
      </head>
      <body>
        <Suspense fallback={null}>
          <InteractionFeedback />
        </Suspense>
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
