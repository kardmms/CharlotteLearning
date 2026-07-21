import { Mail, School } from "lucide-react";
import { submitContactLead } from "@/app/teacher/actions";
import { PublicTopbar } from "@/components/AppTopbar";
import { GradeSlider } from "@/components/GradeSlider";
import { Message } from "@/components/Message";
import { TurnstileField } from "@/components/TurnstileField";

export const dynamic = "force-dynamic";

export default async function ContactPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const query = await searchParams;

  return (
    <>
      <PublicTopbar />
      <main className="page contact-page">
        <section className="contact-intro">
          <div className="contact-icon"><School size={28} /></div>
          <h1>Bring Charlotte AI to your classroom.</h1>
          <p>Share a few details and we&apos;ll reach out about the right classroom plan.</p>
        </section>
        <section className="panel contact-form-panel">
          <Message
            error={query.error}
            success={query.sent ? "Thanks! We received your request and will be in touch." : undefined}
          />
          {!query.sent && (
            <form className="form-grid" action={submitContactLead}>
              <input className="contact-honeypot" name="website" tabIndex={-1} autoComplete="off" />
              <div className="grid two">
                <label>
                  Your name
                  <input name="name" autoComplete="name" maxLength={120} required />
                </label>
                <label>
                  Email
                  <input name="email" type="email" autoComplete="email" maxLength={254} required />
                </label>
                <label>
                  Phone number
                  <input name="phone" type="tel" autoComplete="tel" maxLength={40} required />
                </label>
                <label>
                  School
                  <input name="school" autoComplete="organization" maxLength={160} required />
                </label>
              </div>
              <GradeSlider defaultValue="3" />
              <TurnstileField action="contact" />
              <button className="button" type="submit">
                <Mail size={18} />
                Send request
              </button>
            </form>
          )}
        </section>
      </main>
    </>
  );
}
