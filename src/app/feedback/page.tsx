import Link from "next/link";
import { MessageSquareText, Send } from "lucide-react";
import { submitTeacherFeedback } from "@/app/admin/actions";
import { Message } from "@/components/Message";
import { PasswordField } from "@/components/PasswordField";
import { TurnstileField } from "@/components/TurnstileField";
import { getFeedbackSettings } from "@/lib/admin-metrics";

export const dynamic = "force-dynamic";

export default async function FeedbackPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const query = await searchParams;
  const settings = await getFeedbackSettings();

  return (
    <main className="feedback-page">
      <section className="feedback-card">
        <Link className="admin-auth-brand" href="/">
          <img src="/images/charlotte-ai-logo.png" alt="" />
          <span>Charlotte AI</span>
        </Link>
        <div className="feedback-head">
          <span><MessageSquareText size={28} /></span>
          <div>
            <div className="eyebrow">Weekly feedback</div>
            <h1>Tell us how Charlotte is working.</h1>
            <p>
              Your quick notes help us improve the classroom experience before the next demo week.
            </p>
          </div>
        </div>
        <Message
          error={query.error}
          success={query.saved ? "Thank you. Your feedback was submitted." : undefined}
        />
        {settings.configured ? (
          <form className="feedback-form" action={submitTeacherFeedback}>
            <PasswordField
              name="passcode"
              label="Feedback passcode"
              autoComplete="off"
              helpText={settings.hint ? `Hint: ${settings.hint}` : "Use the passcode shared by Charlotte AI."}
            />
            <div className="grid two">
              <label>
                Your name
                <input name="teacherName" maxLength={120} required placeholder="Teacher name" />
              </label>
              <label>
                Email
                <input name="teacherEmail" type="email" maxLength={254} placeholder="Optional" />
              </label>
            </div>
            <div className="grid two">
              <label>
                Class or school
                <input name="schoolOrClass" maxLength={160} placeholder="Example: 3rd grade demo class" />
              </label>
              <label>
                Week
                <input name="weekOf" maxLength={40} placeholder="Example: Week 1" />
              </label>
            </div>
            <label>
              Overall, how did this week feel?
              <select name="rating" defaultValue="4">
                <option value="5">5 - Very strong</option>
                <option value="4">4 - Good</option>
                <option value="3">3 - Mixed</option>
                <option value="2">2 - Needs work</option>
                <option value="1">1 - Difficult</option>
              </select>
            </label>
            <label>
              What went well?
              <textarea name="strengths" rows={4} maxLength={2000} required />
            </label>
            <label>
              What was hard or confusing?
              <textarea name="struggles" rows={4} maxLength={2000} required />
            </label>
            <label>
              What should we improve next?
              <textarea name="improvements" rows={4} maxLength={2000} required />
            </label>
            <TurnstileField action="teacher_feedback" />
            <button className="button feedback-submit" type="submit">
              <Send size={18} />
              Submit feedback
            </button>
          </form>
        ) : (
          <div className="admin-empty-state light">
            <strong>Feedback is not open yet.</strong>
            <p>Ask the Charlotte AI admin to set a feedback passcode first.</p>
          </div>
        )}
      </section>
    </main>
  );
}
