import {
  AlertTriangle,
  BadgeDollarSign,
  Bot,
  FileCheck2,
  GraduationCap,
  Scale,
  ShieldCheck
} from "lucide-react";
import { PublicTopbar } from "@/components/AppTopbar";

const effectiveDate = "August 18, 2026";

export default function TermsPage() {
  return (
    <>
      <PublicTopbar />
      <main className="page privacy-page">
        <section className="panel privacy-panel privacy-hero">
          <div className="contact-icon"><Scale size={28} /></div>
          <div>
            <div className="eyebrow">Terms of service</div>
            <h1>Terms for Charlotte AI</h1>
            <p className="privacy-updated">Effective and last updated: {effectiveDate}</p>
          </div>
          <p className="privacy-lede">
            These terms explain the rules for using Charlotte AI, a school-directed literacy practice
            service for teachers, schools, and students. They are designed to sit alongside the Privacy
            Notice, not replace school, district, or state requirements.
          </p>
          <div className="privacy-notice">
            <strong>Important legal note</strong>
            <p>
              These product terms help define acceptable use, safety boundaries, and account
              responsibilities. They are not legal advice. Schools should review Charlotte AI under
              their own procurement, student-data, accessibility, and records policies before use.
            </p>
          </div>
        </section>

        <nav className="panel privacy-toc" aria-label="Terms sections">
          <strong>On this page</strong>
          <div>
            <a href="#school-use">School use</a>
            <a href="#accounts">Accounts</a>
            <a href="#uploads">Uploads</a>
            <a href="#ai">AI limits</a>
            <a href="#safety">Student safety</a>
            <a href="#billing">Billing</a>
            <a href="#reviews">Reviews</a>
            <a href="#liability">Availability and liability</a>
          </div>
        </nav>

        <section className="panel privacy-section" id="school-use">
          <div className="privacy-section-heading">
            <GraduationCap size={25} />
            <div>
              <div className="eyebrow">School-directed service</div>
              <h2>Use Charlotte with school authorization</h2>
            </div>
          </div>
          <p>
            Charlotte AI is intended for teacher-led reading practice, classroom reporting, and
            related home-learning workflows. Teachers and schools are responsible for deciding
            whether the service is appropriate for their students, configuring classes correctly,
            reviewing generated material before publication, and using student records consistently
            with school policies and applicable law.
          </p>
          <ul>
            <li>Teachers must have authority from their school, district, or organization to use the service with students.</li>
            <li>Students may use Charlotte only through an authorized class, assignment, or student account.</li>
            <li>The service may not be used for disciplinary, placement, special-education, medical, counseling, or other high-stakes decisions without independent human review and required school process.</li>
            <li>Users may not interfere with security controls, probe systems without permission, scrape the service, or use Charlotte to harm, harass, or impersonate another person.</li>
          </ul>
        </section>

        <section className="panel privacy-section" id="accounts">
          <div className="privacy-section-heading">
            <ShieldCheck size={25} />
            <div>
              <div className="eyebrow">Account responsibilities</div>
              <h2>Keep credentials and class access secure</h2>
            </div>
          </div>
          <p>
            Teachers, administrators, and students are responsible for keeping sign-in credentials
            private. Teachers should invite only the intended students, remove access when a student
            leaves a class, and promptly report suspected unauthorized access.
          </p>
          <ul>
            <li>Do not share teacher, admin, or student passwords with anyone who should not access the account.</li>
            <li>Do not reuse passwords from other school or personal systems.</li>
            <li>Do not attempt to view another class, student, or teacher account without authorization.</li>
            <li>Schools are responsible for maintaining any recovery key they create for protected rosters.</li>
          </ul>
        </section>

        <section className="panel privacy-section" id="uploads">
          <div className="privacy-section-heading">
            <FileCheck2 size={25} />
            <div>
              <div className="eyebrow">Uploads and classroom content</div>
              <h2>Use approved materials and avoid sensitive data</h2>
            </div>
          </div>
          <p>
            Teachers are responsible for the files, roster spreadsheets, titles, notes, and classroom
            content they upload or enter. Upload only materials that the school has the right to use
            and that are appropriate for the assigned class.
          </p>
          <ul>
            <li>Do not upload medical, counseling, disability, disciplinary, family, financial, or government-ID information.</li>
            <li>Do not upload content that infringes copyright, violates school policy, or is unrelated to approved instruction.</li>
            <li>Do not include passwords, access tokens, private keys, or credentials in uploads or prompts.</li>
            <li>Charlotte may remove, restrict, or delete content that appears unlawful, unsafe, abusive, or outside the intended school use.</li>
          </ul>
        </section>

        <section className="panel privacy-section" id="ai">
          <div className="privacy-section-heading">
            <Bot size={25} />
            <div>
              <div className="eyebrow">AI boundaries</div>
              <h2>AI output requires teacher review</h2>
            </div>
          </div>
          <p>
            AI-assisted features can draft reading questions, practice activities, and teacher-facing
            summaries. AI output may be inaccurate, incomplete, biased, or unsuitable. Teachers must
            review generated instructional material before assigning it to students.
          </p>
          <ul>
            <li>Students do not receive an open-ended AI chatbot or AI companion in Charlotte.</li>
            <li>Charlotte does not use AI to diagnose medical, mental-health, disability, or behavioral conditions.</li>
            <li>Charlotte does not use AI as the final decision-maker for placement, discipline, special education, enrollment, or grading policy.</li>
            <li>Generated explanations and summaries are educational aids only and do not replace teacher judgment.</li>
          </ul>
        </section>

        <section className="panel privacy-section" id="safety">
          <div className="privacy-section-heading">
            <AlertTriangle size={25} />
            <div>
              <div className="eyebrow">Student safety</div>
              <h2>Charlotte is not an emergency service</h2>
            </div>
          </div>
          <p>
            Charlotte includes limited local checks that may flag written student responses for
            teacher review when they appear to mention self-harm, violence, abuse, or exploitation.
            These checks are not comprehensive and may miss important signals or flag benign text.
          </p>
          <ul>
            <li>Students in immediate danger should contact a trusted adult, local emergency services, or a school safety contact right away.</li>
            <li>In the United States, students who may hurt themselves can call or text 988 for crisis support.</li>
            <li>Teachers and schools remain responsible for monitoring students and following required safety, mandated-reporting, and escalation procedures.</li>
            <li>Safety flags are teacher-facing records, not clinical assessments or disciplinary conclusions.</li>
          </ul>
        </section>

        <section className="panel privacy-section" id="billing">
          <div className="privacy-section-heading">
            <BadgeDollarSign size={25} />
            <div>
              <div className="eyebrow">Paid services</div>
              <h2>Subscriptions, renewal, cancellation, and refunds</h2>
            </div>
          </div>
          <p>
            If Charlotte offers a paid plan, pricing, renewal timing, cancellation instructions,
            refund terms, and trial limitations must be shown before purchase. Cancellation should
            be available through a straightforward account or support flow that is not materially
            harder than sign-up.
          </p>
          <ul>
            <li>Schools should confirm purchasing authority before starting a paid plan.</li>
            <li>Auto-renewal terms and reminder requirements vary by jurisdiction and must be honored where applicable.</li>
            <li>Refunds are governed by the plan terms shown at purchase unless law requires a different result.</li>
            <li>Charlotte may suspend paid features for nonpayment, fraud, chargeback abuse, or unlawful use.</li>
          </ul>
        </section>

        <section className="panel privacy-section" id="reviews">
          <div className="privacy-section-heading">
            <FileCheck2 size={25} />
            <div>
              <div className="eyebrow">Testimonials and claims</div>
              <h2>Reviews must be truthful</h2>
            </div>
          </div>
          <p>
            Any testimonials, endorsements, ratings, or case studies shown for Charlotte must reflect
            real experiences and must not hide material relationships, compensation, or incentives.
            Charlotte should not publish fake reviews, invented school quotes, or unverifiable claims
            about outcomes.
          </p>
        </section>

        <section className="panel privacy-section" id="liability">
          <div className="privacy-section-heading">
            <Scale size={25} />
            <div>
              <div className="eyebrow">Availability and risk</div>
              <h2>Service limits and liability</h2>
            </div>
          </div>
          <p>
            Charlotte works to keep the service secure and available, but no online service can
            guarantee uninterrupted operation, perfect security, error-free content, or complete
            compatibility with every school system. To the extent permitted by law, Charlotte is
            provided without implied warranties and liability is limited to the amount paid for the
            service during the relevant period.
          </p>
          <ul>
            <li>Schools should maintain their own official gradebooks, student records, backups, and incident procedures.</li>
            <li>Charlotte may update, suspend, or discontinue features to improve security, comply with law, or maintain the service.</li>
            <li>Nothing in these terms limits rights that cannot legally be waived, including rights under applicable student-privacy laws.</li>
            <li>Questions about these terms can be sent through the contact information provided on the site.</li>
          </ul>
        </section>
      </main>
    </>
  );
}
