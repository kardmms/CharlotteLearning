import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock3,
  FileText,
  GraduationCap,
  LineChart,
  ShieldCheck,
  UploadCloud,
  UsersRound
} from "lucide-react";
import { PublicTopbar } from "@/components/AppTopbar";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  return (
    <>
      <PublicTopbar />
      <main className="marketing-page">
        <section className="editorial-hero">
          <div className="marketing-section hero-workspace">
            <div className="hero-copy">
              <div>
                <h1>Reading practice that fits the school day.</h1>
                <div className="hero-rule" />
              </div>
              <p className="lead">
                A little reading. A lot of momentum. Fresh challenges, satisfying wins, and one
                more reason to feel proud of what you learned today.
              </p>
              <div className="hero-badges">
                <span className="hero-badge">
                  <UploadCloud size={16} />
                  Upload a class reading
                </span>
                <span className="hero-badge">
                  <FileText size={16} />
                  Review before assigning
                </span>
                <span className="hero-badge">
                  <LineChart size={16} />
                  Track every question
                </span>
              </div>
              <div className="actions">
                <Link className="button" href="/teacher/signup">
                  Create teacher account
                  <ArrowRight size={18} />
                </Link>
                <Link className="ghost-button" href="/student/login">
                  Student sign in
                </Link>
              </div>
            </div>

            <div className="hero-photo-wrap" aria-label="Classroom reading activity preview">
              <div className="hero-photo-frame" />
              <img
                className="hero-photo"
                src="/images/classroom-hero.png"
                alt="Students and a teacher working together around a laptop"
              />
            </div>
          </div>
        </section>

        <section className="marketing-section" id="features">
          <div className="section-intro">
            <h2>Built around the way teachers already run reading practice.</h2>
            <p className="lead">
              The workflow stays practical: create a class, add students, upload a source, review
              the assignment, and watch progress without digging through a spreadsheet.
            </p>
          </div>
          <div className="grid three">
            <div className="tile feature-card">
              <div className="feature-icon">
                <UploadCloud size={22} />
              </div>
              <h3>From source to station</h3>
              <p>
                Teachers can upload PDF, DOCX, or TXT material and prepare a focused practice set
                for a 15-minute student routine.
              </p>
            </div>
            <div className="tile feature-card">
              <div className="feature-icon">
                <FileText size={22} />
              </div>
              <h3>Google-Forms-style review</h3>
              <p>
                Multiple choice, short answer, paragraph, and prediction formats are selected from
                clean controls instead of hand-typed blocks.
              </p>
            </div>
            <div className="tile feature-card">
              <div className="feature-icon">
                <BarChart3 size={22} />
              </div>
              <h3>Question-level evidence</h3>
              <p>
                See completion, attempts, sign-in times, and how each question performed across the
                class.
              </p>
            </div>
          </div>
        </section>

        <section className="marketing-section" id="benefits">
          <div className="benefit-band">
            <div className="grid two">
              <div>
                <h2 style={{ color: "white" }}>A calmer teacher workspace.</h2>
                <p>
                  Class dashboards, rosters, assignments, exports, and student progress live in
                  separate pages so teachers can move through the day without hunting.
                </p>
              </div>
              <div>
                <h2 style={{ color: "white" }}>A student station that meets the grade level.</h2>
                <p>
                  Younger students get playful motion and friendly visuals. Older students get a
                  focused learning dashboard with progress, goals, and clear assignments.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="marketing-section">
          <div className="section-intro">
            <h2>Built for the way real classrooms work.</h2>
            <p className="lead">
              Keep students engaged with focused reinforcement exercises while giving teachers a
              clear view of participation, progress, and reading evidence.
            </p>
          </div>
          <div className="grid three">
            <div className="testimonial-card">
              <UsersRound color="#2563EB" />
              <h3>Class setup</h3>
              <p>Teachers enroll student emails, and each learner uses one account across all of their classes.</p>
            </div>
            <div className="testimonial-card">
              <Clock3 color="#14B8A6" />
              <h3>Session history</h3>
              <p>Teachers can see when students signed in, when they last worked, and what remains.</p>
            </div>
            <div className="testimonial-card">
              <ShieldCheck color="#2563EB" />
              <h3>Secure by design</h3>
              <p>Teacher accounts, hashed passwords, server-side keys, and class-scoped access.</p>
            </div>
          </div>
        </section>

        <section className="marketing-section" id="contact">
          <div className="pricing-panel">
            <div>
              <h2>Interested in starting a Charlotte program for your class?</h2>
              <p>
                Tell us the basics about the students you serve. We&apos;ll help you choose the
                right starting point and share pricing for your classroom.
              </p>
              <div className="hero-badges">
                <span className="hero-badge">
                  <CheckCircle2 size={16} />
                  No student ads
                </span>
                <span className="hero-badge">
                  <CheckCircle2 size={16} />
                  Teacher review first
                </span>
                <span className="hero-badge">
                  <CheckCircle2 size={16} />
                  CSV exports
                </span>
              </div>
            </div>
            <div className="panel contact-cta-card">
              <h2>Let&apos;s talk.</h2>
              <p>Start with one class or plan a broader school program.</p>
              <Link className="button" href="/contact">
                Contact us
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <footer className="footer">
        <div className="footer-inner">
          <Link className="brand" href="/">
            <img className="brand-logo" src="/images/charlotte-ai-logo.png" alt="" />
            <span>Charlotte AI</span>
          </Link>
          <div className="nav-links">
            <Link href="/teacher/login">Teacher login</Link>
            <Link href="/student/login">Student sign in</Link>
            <Link href="/privacy">Privacy</Link>
            <BookOpen size={18} color="#64748B" />
          </div>
        </div>
      </footer>
    </>
  );
}
