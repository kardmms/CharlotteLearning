import type { Metadata } from "next";
import { Suspense } from "react";
import { InteractionFeedback } from "@/components/InteractionFeedback";
import { NetworkResourceMode } from "@/components/NetworkResourceMode";
import "./globals.css";

export const metadata: Metadata = {
  title: "Charlotte AI",
  description: "Short reading challenges, optional practice, and classroom momentum."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var r=document.documentElement,t=localStorage.getItem('charlotte-theme');if(t==='dark'){r.dataset.theme='dark';}var c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;if(!navigator.onLine){r.dataset.resourceMode='offline';}else if(c&&(c.saveData||c.effectiveType==='slow-2g'||c.effectiveType==='2g'||(c.downlink&&c.downlink<1.2)||(c.rtt&&c.rtt>700))){r.dataset.resourceMode='constrained';}}catch(e){}"
          }}
        />
      </head>
      <body>
        <Suspense fallback={null}>
          <NetworkResourceMode />
          <InteractionFeedback />
        </Suspense>
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
