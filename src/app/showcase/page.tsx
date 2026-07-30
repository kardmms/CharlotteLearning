import Link from "next/link";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { startShowcase } from "@/app/showcase/actions";
import { PublicTopbar } from "@/components/AppTopbar";

export default function ShowcasePage() {
  return (
    <>
      <PublicTopbar />
      <main className="page narrow-page">
        <section className="panel showcase-coming-soon">
          <div className="feature-icon">
            <Sparkles size={22} />
          </div>
          <div className="eyebrow">Showcase Mode</div>
          <h1>Explore the real Charlotte teacher workspace.</h1>
          <p>
            Open the same teacher portal used in a classroom, preloaded with a fictional grade 5
            class and an original reading activity. Simulated students will begin working while
            you explore live progress, responses, assignments, and analytics.
          </p>
          <div className="actions">
            <form action={startShowcase}>
              <button className="button" type="submit">
                Start showcase
                <ArrowRight size={18} />
              </button>
            </form>
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
