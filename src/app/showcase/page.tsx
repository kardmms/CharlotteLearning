import Link from "next/link";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { startShowcase } from "@/app/showcase/actions";
import { PublicTopbar } from "@/components/AppTopbar";
import { Message } from "@/components/Message";

export default async function ShowcasePage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; expired?: string }>;
}) {
  const query = await searchParams;

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
            Start at the beginning of the same teacher portal used in a classroom. Create a class,
            build an assignment, and then run 12 private fictional students through it while you
            watch live progress, responses, and analytics.
          </p>
          <Message
            error={query.error}
            success={query.expired ? "That showcase expired. Start a fresh one to continue exploring." : undefined}
          />
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
