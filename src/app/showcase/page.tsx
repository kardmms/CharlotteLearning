import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { PublicTopbar } from "@/components/AppTopbar";

export default function ShowcaseComingSoonPage() {
  return (
    <>
      <PublicTopbar />
      <main className="page narrow-page">
        <section className="panel showcase-coming-soon">
          <div className="feature-icon">
            <Sparkles size={22} />
          </div>
          <div className="eyebrow">Showcase Mode</div>
          <h1>Charlotte&apos;s guided classroom demo is coming soon.</h1>
          <p>
            We&apos;re building a safe simulation where teachers and partners can create a class,
            generate an activity, run student responses, and explore the analytics without using
            real student data.
          </p>
          <div className="actions">
            <Link className="ghost-button" href="/">
              <ArrowLeft size={18} />
              Back home
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
