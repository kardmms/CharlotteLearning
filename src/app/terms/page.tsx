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
            service for teachers, schools, and students. They work together with the Privacy Notice and
            any written school or district agreement that applies.
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
          <ul className="privacy-wide-list">
            <li>Use only your own teacher, student, or administrator account.</li>
            <li>Keep passwords, recovery keys, invite links, and admin credentials private.</li>
            <li>Do not attempt to view another class, student, teacher, admin area, database record, API route, or provider account without authorization.</li>
            <li>Do not upload malware, attempt scraping, bypass rate limits, attack the service, or probe vulnerabilities without written permission.</li>
            <li>Schools are responsible for maintaining any recovery key they create for protected rosters.</li>
          </ul>
          <p>
            Charlotte may suspend or remove access when needed to protect students, schools, users, the
            service, or provider systems, or when an account appears to violate these terms.
          </p>
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
            Teachers and schools are responsible for the files, roster spreadsheets, titles, notes,
            and classroom content they upload or enter. Upload only material that the school has the
            right to use and that is appropriate for the assigned class.
          </p>
          <ul>
            <li>Do not upload medical, counseling, disability, disciplinary, family, financial, government-ID, or payment information.</li>
            <li>Do not upload content that infringes copyright, violates school policy, or is unrelated to approved instruction.</li>
            <li>Do not include passwords, access tokens, private keys, or credentials in uploads or prompts.</li>
            <li>Charlotte may remove, restrict, or delete content that appears unlawful, unsafe, abusive, or outside the intended school use.</li>
          </ul>
          <p>
            As between the school or user and Charlotte, the school or user keeps ownership of their
            uploaded content and student work. Charlotte receives the limited permission needed to host,
            process, secure, display, export, delete, and support that content as part of the service.
          </p>
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
            AI-assisted features can draft reading questions, practice activities, roster parsing,
            and teacher-facing summaries as described in the Privacy Notice. AI output may be
            inaccurate, incomplete, biased, or unsuitable. Teachers must review generated questions,
            answers, explanations, rubrics, summaries, and suggestions before relying on them or
            assigning them to students.
          </p>
          <ul>
            <li>Students do not receive an open-ended AI chatbot or AI companion in Charlotte.</li>
            <li>Charlotte does not provide legal, medical, counseling, mental-health, special-education, disability, discipline, placement, or emergency advice.</li>
            <li>AI-assisted output must not be used as the sole basis for decisions that materially affect a student&apos;s rights, services, placement, safety, or access to education.</li>
            <li>Generated explanations and summaries are educational aids only and do not replace teacher judgment.</li>
          </ul>
        </section>

        <section className="panel privacy-section" id="safety">
          <div className="privacy-section-heading">
            <AlertTriangle size={25} />
            <div>
              <div className="eyebrow">Human response</div>
              <h2>Student safety flags</h2>
            </div>
          </div>
          <p>
            Charlotte may flag written student responses that clearly signal self-harm, violence, or
            abuse/exploitation. These flags are intended to route a response to responsible adults; they
            are not a diagnosis, risk score, emergency dispatch system, or substitute for school safety
            procedures. Automated checks can miss concerning content or flag content that is not actually
            about the student.
          </p>
          <p>
            Schools and authorized staff are responsible for reviewing safety flags promptly and following
            their own mandated-reporting, emergency-response, parent/guardian-notification, and student
            support policies.
          </p>
        </section>

        <section className="panel privacy-section" id="billing">
          <div className="privacy-section-heading">
            <BadgeDollarSign size={25} />
            <div>
              <div className="eyebrow">No in-app charges</div>
              <h2>Fees, subscriptions, and renewals</h2>
            </div>
          </div>
          <p>
            Charlotte currently does not process payment-card data, in-app purchases, paid subscriptions,
            free trials that convert to paid plans, or automatic renewals inside the application. Any paid
            school, classroom, pilot, or district arrangement is handled outside the app under a separate
            written agreement, invoice, or order form.
          </p>
          <p>
            Charlotte should not add in-app billing, subscriptions, automatic renewals, paid trials, or
            cancellation workflows unless the pricing terms, renewal terms, reminders, cancellation method,
            refund rules, and required consumer or business notices are reviewed and published before launch.
          </p>
        </section>

        <section className="panel privacy-section" id="reviews">
          <div className="privacy-section-heading">
            <FileCheck2 size={25} />
            <div>
              <div className="eyebrow">Truthful marketing</div>
              <h2>Reviews, testimonials, and public claims</h2>
            </div>
          </div>
          <p>
            Any public reviews, testimonials, case studies, endorsements, statistics, screenshots, or school
            references must be truthful, authorized, and not misleading. Do not submit or publish fake
            reviews, invented customer quotes, undisclosed insider reviews, compensated endorsements without
            required disclosure, or claims that overstate what Charlotte does.
          </p>
        </section>

        <section className="panel privacy-section" id="liability">
          <div className="privacy-section-heading">
            <Scale size={25} />
            <div>
              <div className="eyebrow">Service boundaries</div>
              <h2>Availability, security, and liability</h2>
            </div>
          </div>
          <p>
            Charlotte works to protect the service through access controls, encryption, rate limits,
            security headers, audit records, retention controls, and operational safeguards. No online
            service can guarantee uninterrupted availability, error-free output, or perfect security.
          </p>
          <p>
            To the fullest extent allowed by law, Charlotte is provided without warranties beyond those
            expressly stated in a written agreement, and Charlotte is not liable for indirect, incidental,
            consequential, special, exemplary, or punitive damages. Some jurisdictions do not allow certain
            limitations, so those limitations apply only where permitted.
          </p>
          <p>
            Charlotte may update these terms as the product, providers, legal requirements, or school use
            cases change. Material updates will use a new effective date and, where appropriate, be
            communicated to schools. Questions can be sent to{` `}
            <a href="mailto:hello@charlottelearning.ai">hello@charlottelearning.ai</a>.
          </p>
        </section>
      </main>
    </>
  );
}
