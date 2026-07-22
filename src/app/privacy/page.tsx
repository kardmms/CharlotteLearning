import { ShieldCheck } from "lucide-react";
import { PublicTopbar } from "@/components/AppTopbar";

export default function PrivacyPage() {
  return (
    <>
      <PublicTopbar />
      <main className="page privacy-page">
        <section className="panel privacy-panel">
          <div className="contact-icon"><ShieldCheck size={28} /></div>
          <h1>Privacy at Charlotte AI</h1>
          <p>
            Charlotte AI keeps classroom data focused on reading practice. We collect the minimum
            information needed to run teacher accounts, student accounts, class rosters, assignments,
            and progress reports.
          </p>

          <div className="privacy-grid">
            <section>
              <h2>What We Store</h2>
              <ul>
                <li>Teacher name, email, and hashed password.</li>
                <li>Student name, email, and hashed password for standard classes.</li>
                <li>For recovery-key protected classes: student numbers, encrypted identity data, and a one-way email lookup hash.</li>
                <li>Classroom names, grade level, assignments, uploaded reading text, and question data.</li>
                <li>Student answers, attempts, completion status, and scores for teacher review.</li>
                <li>Contact requests: name, email, grade level, and optional phone or school.</li>
              </ul>
            </section>

            <section>
              <h2>What We Avoid</h2>
              <ul>
                <li>No ads, ad tracking, or student behavior profiles.</li>
                <li>No student phone numbers, addresses, birthdates, or payment details.</li>
                <li>No uploaded original files kept after text extraction.</li>
                <li>No API keys or secrets in browser code.</li>
                <li>No raw classroom recovery keys stored by Charlotte.</li>
              </ul>
            </section>

            <section>
              <h2>How We Protect It</h2>
              <ul>
                <li>HTTPS-only production traffic and HTTP-only session cookies.</li>
                <li>Managed cloud hosting and managed Postgres with provider encryption controls.</li>
                <li>Teacher-held classroom recovery keys for database-anonymous student rosters.</li>
                <li>Class-scoped teacher and student access checks on every protected route.</li>
                <li>Rate limits, bot checks, dependency scanning, and security headers.</li>
              </ul>
            </section>

            <section>
              <h2>Retention</h2>
              <ul>
                <li>Contact requests are automatically removed after the configured retention window.</li>
                <li>Classroom records remain available to teachers until they archive or delete them.</li>
                <li>Students can keep one simple account for every class their teacher enrolls them in.</li>
              </ul>
            </section>
          </div>
        </section>
      </main>
    </>
  );
}
