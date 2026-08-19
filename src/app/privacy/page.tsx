import {
  AlertTriangle,
  Bot,
  Clock3,
  Database,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import { PublicTopbar } from "@/components/AppTopbar";

const effectiveDate = "August 18, 2026";

export default function PrivacyPage() {
  return (
    <>
      <PublicTopbar />
      <main className="page privacy-page">
        <section className="panel privacy-panel privacy-hero">
          <div className="contact-icon"><ShieldCheck size={28} /></div>
          <div>
            <div className="eyebrow">Student and school privacy notice</div>
            <h1>Privacy at Charlotte AI</h1>
            <p className="privacy-updated">Effective and last updated: {effectiveDate}</p>
          </div>
          <p className="privacy-lede">
            Charlotte AI is a school-directed literacy learning service provided as part of
            Charlotte Learning. This notice explains, in plain language, what information the
            service handles, why it is needed, who can access it, how artificial intelligence is
            used, and what schools and families can do about their information.
          </p>
          <div className="privacy-notice">
            <strong>An important clarification about student identity information</strong>
            <p>
              The current service uses a student name and email address for enrollment, invitations,
              sign-in, and linking one student account to the correct classes. We therefore do not
              claim that Charlotte never processes names or email addresses. New classrooms use a
              school-held recovery key so those identity fields are stored as encrypted values rather
              than readable roster data. Older or specially configured standard classrooms may store
              names and email addresses in readable form. The sections below explain both modes.
            </p>
          </div>
        </section>

        <nav className="panel privacy-toc" aria-label="Privacy notice sections">
          <strong>On this page</strong>
          <div>
            <a href="#student-ai">Students and AI</a>
            <a href="#student-safety">Student safety</a>
            <a href="#information-we-store">Information we store</a>
            <a href="#information-we-avoid">Information we avoid</a>
            <a href="#access-and-sharing">Access and sharing</a>
            <a href="#security">Security</a>
            <a href="#retention">Retention and deletion</a>
            <a href="#family-rights">Family and school choices</a>
          </div>
        </nav>

        <section className="privacy-summary-grid" aria-label="Privacy highlights">
          <article className="panel privacy-summary-card">
            <Bot size={24} />
            <h2>No student AI chat</h2>
            <p>Students cannot message, prompt, or hold a conversation with an AI model.</p>
          </article>
          <article className="panel privacy-summary-card">
            <EyeOff size={24} />
            <h2>No ads or data sale</h2>
            <p>Student data is not sold, rented, used for targeted advertising, or used to build commercial profiles.</p>
          </article>
          <article className="panel privacy-summary-card">
            <KeyRound size={24} />
            <h2>School-held roster key</h2>
            <p>New-class names and emails are encrypted with a recovery key Charlotte does not retain.</p>
          </article>
          <article className="panel privacy-summary-card">
            <UsersRound size={24} />
            <h2>School-directed use</h2>
            <p>Teachers choose the materials, assignments, classes, and instructional uses of the service.</p>
          </article>
          <article className="panel privacy-summary-card">
            <AlertTriangle size={24} />
            <h2>Local safety flags</h2>
            <p>Written responses can be locally flagged for teacher review when they suggest urgent safety concerns.</p>
          </article>
        </section>

        <section className="panel privacy-section" id="student-ai">
          <div className="privacy-section-heading">
            <Bot size={25} />
            <div>
              <div className="eyebrow">A clear boundary</div>
              <h2>Students do not talk to the AI</h2>
            </div>
          </div>
          <p>
            Charlotte AI is not a student chatbot, companion, social network, or open-ended advice
            service. A student does not see a prompt box for an AI model and cannot send messages to
            an AI model. Students see only the reading material, questions, explanations, and practice
            activities made available through their class.
          </p>
          <p>
            AI controls are available only in teacher-facing or server-side instructional workflows.
            Teachers decide what source material to use, what class and grade level the work is for,
            whether generated material should be edited, and whether an assignment should be published.
            Some teacher-enabled workflows can generate additional practice after student activity, but
            the student still does not provide an AI prompt or enter an AI conversation.
          </p>
          <div className="privacy-columns">
            <div>
              <h3>What AI may help teachers do</h3>
              <ul>
                <li>Create draft literacy questions from teacher-provided reading material.</li>
                <li>Suggest age-appropriate vocabulary, comprehension, prediction, and written-response practice.</li>
                <li>Create additional at-home practice using source text and skill-level performance patterns.</li>
                <li>Organize a teacher-uploaded roster spreadsheet into name and email columns.</li>
                <li>Summarize class performance and suggest possible follow-up or a mini-lesson.</li>
                <li>Draft the narrative portion of an optional weekly teacher analytics email.</li>
              </ul>
            </div>
            <div>
              <h3>What AI is not allowed to do in Charlotte</h3>
              <ul>
                <li>Hold a conversation with a student or accept a student-authored AI prompt.</li>
                <li>Provide counseling, medical advice, mental-health advice, or crisis support.</li>
                <li>Diagnose a disability, learning disorder, medical condition, or behavioral condition.</li>
                <li>Make enrollment, placement, disciplinary, special-education, or other high-stakes decisions.</li>
                <li>Replace the teacher&apos;s professional review of generated instructional material.</li>
                <li>Use student information for advertising or unrelated commercial profiling.</li>
              </ul>
            </div>
          </div>
          <h3>Information sent in AI-assisted workflows</h3>
          <p>
            The exact input depends on the tool. Assignment generation can send the teacher&apos;s uploaded
            reading text, title, grade level, instructional focus, and standards reference. Additional
            practice can send reading text, earlier question prompts, and skill areas that need practice;
            it does not need the student&apos;s name or email. The weekly email narrative uses anonymous labels
            such as “Class 1” and “Student 1” with aggregate participation, accuracy, and question-type
            statistics. The final email sent to the teacher can contain real student names, but those names
            are added after the AI narrative is generated.
          </p>
          <p>
            Roster imports are parsed locally by default and the on-demand class summary uses anonymous
            student labels and generic assignment labels. Charlotte does not send student names, student
            emails, classroom names, assignment titles, or raw student answer text to the on-demand class
            summary prompt. The roster-import AI assistant remains disabled unless Charlotte has reviewed
            the school use case and confirmed the required OpenAI zero-data-retention controls for the
            project. Teachers should use only school-approved files and should never place medical,
            special-education, disciplinary, family, or other highly sensitive information in an upload,
            class title, assignment title, or roster file.
          </p>
          <p>
            Charlotte currently uses the OpenAI API for these features. OpenAI states that API inputs and
            outputs are not used to train its models by default. API content may still be retained in abuse-
            monitoring logs for a limited period under OpenAI&apos;s applicable data controls. See OpenAI&apos;s{` `}
            <a href="https://platform.openai.com/docs/guides/your-data" target="_blank" rel="noreferrer">
              API data-control documentation
            </a>.
          </p>
          <div className="privacy-callout">
            <strong>Teacher review remains essential.</strong> AI output can be incomplete, inaccurate,
            biased, or unsuitable. Teachers can review and edit generated material before publication.
            Multiple-choice responses are scored against the answer key in the assignment; open-ended
            responses remain available for teacher review and grading.
          </div>
        </section>

        <section className="panel privacy-section" id="student-safety">
          <div className="privacy-section-heading">
            <AlertTriangle size={25} />
            <div>
              <div className="eyebrow">Safety response</div>
              <h2>Written-answer safety flags</h2>
            </div>
          </div>
          <p>
            Charlotte is not an emergency, counseling, or mental-health service. Because students can type
            written reading responses, Charlotte locally checks submitted answers for clear signals of
            self-harm, violence, or abuse/exploitation. This check is deterministic and happens inside the
            application; student crisis text is not sent to an AI provider for this safety screen.
          </p>
          <p>
            If a response is flagged, Charlotte saves the answer with safety-flag metadata, records an audit
            event, shows the student a brief notice to tell a teacher or trusted adult, and surfaces the flag
            in teacher response views, progress views, and CSV exports. The flag is a routing signal for human
            review, not a diagnosis or a final determination. Automated checks can miss context or flag a
            classroom-literature response that is not actually a personal safety issue.
          </p>
          <p>
            Schools remain responsible for their own student-safety, mandated-reporting, emergency-response,
            parent/guardian-notification, and record-handling procedures. Teachers and administrators should
            follow school policy promptly whenever a safety flag appears or when any student communication
            independently raises concern.
          </p>
        </section>

        <section className="panel privacy-section" id="information-we-store">
          <div className="privacy-section-heading">
            <Database size={25} />
            <div>
              <div className="eyebrow">Data inventory</div>
              <h2>Information Charlotte stores or processes</h2>
            </div>
          </div>
          <p>
            Charlotte limits collection to information used to provide accounts, classroom access,
            instructional content, learning activity, security, teacher reporting, support, and service
            operations. Depending on the features a school uses, the following information may be handled.
          </p>
          <div className="privacy-detail-grid">
            <article>
              <h3>Student account and roster information</h3>
              <ul>
                <li>Student display name, which may be a first name, first and last name, initials, or a school-selected identifier.</li>
                <li>Student email address used for enrollment invitations, account registration, sign-in, and class matching.</li>
                <li>A one-way email lookup hash used to match protected enrollments without storing a readable email in the roster record.</li>
                <li>A password hash used to verify sign-in. Charlotte does not store the student&apos;s readable password.</li>
                <li>Student account ID, class enrollment ID, active status, and account or enrollment creation time.</li>
                <li>Encrypted copies of names and email addresses for recovery-key protected classrooms.</li>
                <li>Pseudonymous labels such as “Student 1” where protected classroom records need a non-identifying database label.</li>
              </ul>
            </article>
            <article>
              <h3>Classroom and instructional information</h3>
              <ul>
                <li>Teacher name, teacher email, hashed password, and weekly-summary preference.</li>
                <li>Classroom name, grade level, creation date, archive status, and teacher relationship.</li>
                <li>Assignment titles, availability and due dates, estimated duration, teacher notes, and publication status.</li>
                <li>Teacher-uploaded reading text, extracted text, source filename, source preview, content hash, and reading scope.</li>
                <li>Generated or teacher-edited questions, choices, answer keys, rubrics, explanations, skill tags, standards, excerpts, and page references.</li>
                <li>At-home resources and adaptive practice materials created for a class or student enrollment.</li>
              </ul>
            </article>
            <article>
              <h3>Student learning and activity records</h3>
              <ul>
                <li>Student answer text, including written responses entered by the student.</li>
                <li>Safety-flag category and timestamp when a written answer clearly signals self-harm, violence, or abuse/exploitation.</li>
                <li>Whether an answer was correct, attempt count, first-try result, points, and whether an answer was revealed.</li>
                <li>Session start, last-active, sign-out, and completion timestamps.</li>
                <li>Assignment status such as in progress, partial, or completed.</li>
                <li>Learning-progress checklist events, including whether the student opened the book, found the chapter, answered a prompt, made a prediction, or completed the activity.</li>
                <li>Focus-loss counts and related timestamps used when an activity is configured to track leaving the activity window.</li>
                <li>Safety flag category and timestamp when a written response appears to mention self-harm, violence, abuse, or exploitation.</li>
                <li>Class, skill, question-type, participation, completion, and accuracy analytics derived from the records above.</li>
              </ul>
            </article>
            <article>
              <h3>Security and operational records</h3>
              <ul>
                <li>Short-lived secure session cookies containing account role and identifiers needed to keep a user signed in.</li>
                <li>Hashed network or account identifiers in rate-limit records used to prevent abuse; the application does not store the raw IP address in those database records.</li>
                <li>Cloud hosting and security providers may process ordinary request information such as IP address, browser details, time, requested page, and error information.</li>
                <li>Audit records for account, classroom, email, and destructive actions, including actor and target IDs and limited event metadata.</li>
                <li>Email-delivery records containing a recipient hash, subject, delivery status, provider message ID, error code, and relevant class or account IDs.</li>
                <li>Contact-form information: name, email, grade level, optional phone number or school name, follow-up status, and submission/update timestamps.</li>
                <li>Teacher feedback: optional teacher email, school or class, rating, strengths, struggles, and requested improvements.</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="panel privacy-section" id="information-we-avoid">
          <div className="privacy-section-heading">
            <EyeOff size={25} />
            <div>
              <div className="eyebrow">Data minimization</div>
              <h2>Information Charlotte does not request as student profile fields</h2>
            </div>
          </div>
          <p>
            Charlotte does not provide dedicated student-profile fields for the sensitive information
            below and does not need it to provide literacy practice. Schools, teachers, and students
            should not place this information in names, classroom titles, assignment titles, uploaded
            documents, roster spreadsheets, teacher notes, or written answers.
          </p>
          <div className="privacy-columns privacy-avoid-list">
            <ul>
              <li>District or state student identification numbers.</li>
              <li>Birth dates, ages, or birth-certificate information.</li>
              <li>Home or mailing addresses.</li>
              <li>Student telephone numbers.</li>
              <li>Parent, guardian, sibling, or emergency-contact information.</li>
              <li>Photographs, facial images, or profile pictures.</li>
              <li>Audio recordings, voiceprints, or video recordings.</li>
              <li>Precise geolocation or continuous location history.</li>
            </ul>
            <ul>
              <li>Medical, health, counseling, or medication information.</li>
              <li>Disability status, IEPs, 504 plans, or special-education records.</li>
              <li>Disciplinary, suspension, law-enforcement, or juvenile-justice records.</li>
              <li>Biometric identifiers, fingerprints, or retina scans.</li>
              <li>Social Security, passport, driver&apos;s-license, or government-issued ID numbers.</li>
              <li>Financial, payment-card, benefits, or family-income information.</li>
              <li>Religious beliefs, immigration status, or citizenship information.</li>
              <li>Passwords or credentials used for any other school, district, family, or online system.</li>
            </ul>
          </div>
          <div className="privacy-callout warning">
            <strong>Free text and uploads require care.</strong> A system cannot promise that information
            will never be stored if a user voluntarily types it into an open response or if a teacher
            uploads a file containing it. If sensitive information is entered accidentally, contact the
            school and Charlotte promptly so the relevant record can be reviewed and, where appropriate,
            corrected or deleted.
          </div>
        </section>

        <section className="panel privacy-section" id="protected-rosters">
          <div className="privacy-section-heading">
            <KeyRound size={25} />
            <div>
              <div className="eyebrow">Identity protection</div>
              <h2>Recovery-key protected rosters</h2>
            </div>
          </div>
          <p>
            New classrooms are created in school-key mode. The service generates a classroom recovery
            key for the teacher or school to save securely. The key is used to derive an encryption key;
            the raw recovery key is not retained by Charlotte. Student names and email addresses are
            encrypted with AES-256-GCM before they are written to protected roster records. The database
            keeps encrypted identity values, pseudonymous labels, a salt and verifier, and one-way lookup
            hashes needed to match an email to the correct enrollment.
          </p>
          <p>
            A teacher signed in to the correct teacher account must also enter the matching classroom
            recovery key to reveal protected roster names and emails. The key is checked for that request
            and is not saved as part of the classroom record. Charlotte personnel and application
            administrators cannot recover the readable protected roster from the stored ciphertext alone.
            If the school loses the recovery key, Charlotte may be unable to restore those identities.
          </p>
          <p>
            Encryption does not make a record nonexistent. Charlotte still stores ciphertext, lookup
            hashes, account and enrollment identifiers, activity records, and learning records. A school
            that exports or reveals a roster is responsible for protecting the resulting readable copy.
            Older standard classrooms can store readable names and email addresses and should be treated
            as education records subject to the school&apos;s access controls.
          </p>
        </section>

        <section className="panel privacy-section" id="access-and-sharing">
          <div className="privacy-section-heading">
            <UsersRound size={25} />
            <div>
              <div className="eyebrow">Limited disclosure</div>
              <h2>Who can access information and why</h2>
            </div>
          </div>
          <div className="privacy-detail-grid">
            <article>
              <h3>Teachers and schools</h3>
              <p>
                A teacher can access the classrooms, assignments, roster records, student responses,
                safety flags, activity history, and reports tied to that teacher&apos;s account. Protected
                names and emails additionally require the class recovery key. Schools may designate
                authorized personnel and may request support, access, correction, export, or deletion
                consistent with their agreement and applicable law.
              </p>
            </article>
            <article>
              <h3>Students</h3>
              <p>
                A student can access the active classes linked to that student account, assigned learning
                material, the student&apos;s own activity, and appropriate results. Students are not given
                access to another student&apos;s account, answers, roster entry, or teacher dashboard.
              </p>
            </article>
            <article>
              <h3>Authorized Charlotte administrators</h3>
              <p>
                A limited number of authorized administrators can access operational dashboards, account
                records, standard roster data, classroom records, usage metrics, support information,
                audit events, and delivery records when needed to operate, secure, troubleshoot, or support
                the service. Protected roster identities remain encrypted without the school-held key.
              </p>
            </article>
            <article>
              <h3>Service providers</h3>
              <p>
                Charlotte uses service providers only to perform functions needed for the service. These
                currently include Vercel for application hosting and operational delivery, a managed
                Postgres provider for database storage and backups, OpenAI for the AI workflows described
                above, Resend for account and classroom email delivery, and Cloudflare Turnstile for bot
                and abuse protection. Each provider receives the information necessary for its function.
              </p>
            </article>
          </div>
          <h3>Other limited disclosures</h3>
          <p>
            Charlotte may disclose information when directed by the school; when a school or parent has
            authorized the disclosure; to investigate or prevent fraud, abuse, or a security incident; to
            protect the safety, rights, or integrity of users or the service; or when required by a valid
            legal process. Where legally permitted, Charlotte will seek to direct requests for school-
            controlled student records to the school and will limit a disclosure to what is required.
          </p>
          <div className="privacy-callout success">
            <strong>Charlotte does not sell or rent student information.</strong> Charlotte does not use
            student information for targeted advertising, cross-context behavioral advertising, building
            an unrelated commercial profile, or marketing products directly to students. Charlotte does
            not display third-party advertisements in the student experience.
          </div>
        </section>

        <section className="panel privacy-section" id="cookies">
          <div className="privacy-section-heading">
            <LockKeyhole size={25} />
            <div>
              <div className="eyebrow">Sessions and diagnostics</div>
              <h2>Cookies, network data, and automated collection</h2>
            </div>
          </div>
          <p>
            Charlotte uses necessary session cookies to keep teachers, students, and administrators signed
            in and to remember limited activity state. Authentication cookies are HTTP-only, use same-site
            protections, and are marked secure in production. Teacher and administrator sessions expire
            after approximately eight hours; student sessions expire after approximately six hours.
          </p>
          <p>
            Requests to the service necessarily carry technical information such as an IP address, browser
            type, requested route, and time. Charlotte hashes network or account identifiers before storing
            application rate-limit keys. Hosting, network, and bot-protection providers can separately
            process request metadata and, when Turnstile is enabled, a security token and IP address to
            distinguish legitimate use from automated abuse. Charlotte does not use advertising cookies
            or third-party ad trackers in the student experience.
          </p>
          <p>
            The activity window can record a count when a student leaves the focused activity and can end
            an activity after repeated focus loss. This feature does not turn on a camera or microphone,
            record the screen, read other tabs, capture the content of another application, or track the
            student outside the Charlotte activity. It records only the focus-loss event and related time.
          </p>
        </section>

        <section className="panel privacy-section" id="security">
          <div className="privacy-section-heading">
            <ShieldCheck size={25} />
            <div>
              <div className="eyebrow">Safeguards</div>
              <h2>How information is protected</h2>
            </div>
          </div>
          <ul className="privacy-wide-list">
            <li>HTTPS is required for production traffic so information is encrypted while traveling between a browser and the service.</li>
            <li>Passwords are transformed with a one-way bcrypt hash and are not stored or emailed in readable form.</li>
            <li>Protected roster identity fields use classroom-key encryption, and the raw classroom recovery key is not stored.</li>
            <li>Managed hosting, database, and backup providers supply infrastructure encryption and access controls.</li>
            <li>Teacher, student, and administrator routes perform role and ownership checks before protected data is returned.</li>
            <li>Secure, HTTP-only session cookies reduce exposure of authentication tokens to browser scripts.</li>
            <li>Rate limits, same-origin checks, bot protection, restricted outbound hosts, input limits, and security headers reduce common abuse paths.</li>
            <li>Audit events and email-delivery records help investigate important account, classroom, deletion, and communication activity.</li>
            <li>Application secrets and provider API keys are stored server-side and are not intentionally included in browser code.</li>
            <li>Backups are maintained to support continuity and recovery, and restoration procedures are tested outside production.</li>
          </ul>
          <p>
            No website, database, encryption method, or transmission is guaranteed to be completely secure.
            Schools should protect teacher accounts, use unique passwords, limit account sharing, retain
            classroom recovery keys in an approved secure location, remove access that is no longer needed,
            and report suspected misuse promptly. Charlotte reviews credible security concerns and will
            coordinate legally required incident notices with affected schools and users as appropriate.
          </p>
        </section>

        <section className="panel privacy-section" id="retention">
          <div className="privacy-section-heading">
            <Clock3 size={25} />
            <div>
              <div className="eyebrow">Information lifecycle</div>
              <h2>Retention, archival, and deletion</h2>
            </div>
          </div>
          <div className="privacy-retention-table" role="table" aria-label="Data retention summary">
            <div className="privacy-retention-row privacy-retention-head" role="row">
              <span role="columnheader">Record</span>
              <span role="columnheader">Current retention approach</span>
            </div>
            <div className="privacy-retention-row" role="row">
              <strong role="cell">Classrooms and learning records</strong>
              <span role="cell">Remain available while needed by the teacher or school. Archiving hides a class from active views but does not delete it. Deleting a class removes its roster rows, assignments, questions, sessions, answers, and answer-level safety flags through related-record deletion.</span>
            </div>
            <div className="privacy-retention-row" role="row">
              <strong role="cell">Student accounts</strong>
              <span role="cell">Can remain after one class is deleted because one student account may be linked to multiple classes. A verified school or family request is needed to review deletion of the separate account.</span>
            </div>
            <div className="privacy-retention-row" role="row">
              <strong role="cell">Teacher accounts</strong>
              <span role="cell">Remain while the account and associated school use are active or until deletion is requested and verified, subject to legal or security preservation needs.</span>
            </div>
            <div className="privacy-retention-row" role="row">
              <strong role="cell">Contact requests</strong>
              <span role="cell">Automatically deleted after the configured contact-retention period. The application defaults to 180 days and constrains the operational setting to a 30-to-730-day range.</span>
            </div>
            <div className="privacy-retention-row" role="row">
              <strong role="cell">Rate-limit records</strong>
              <span role="cell">Expire after their security window and are removed by periodic cleanup. The scheduled privacy cleanup removes stale buckets whose reset time is more than about 24 hours old.</span>
            </div>
            <div className="privacy-retention-row" role="row">
              <strong role="cell">Email and audit records</strong>
              <span role="cell">Retained as operational and security history while reasonably needed. Delivery logs use a recipient hash rather than a readable recipient address, although the email provider processes the address to deliver the message.</span>
            </div>
            <div className="privacy-retention-row" role="row">
              <strong role="cell">Provider copies and backups</strong>
              <span role="cell">Deletion from the live application may not immediately remove copies in provider logs, email systems, disaster-recovery snapshots, or backups. Those copies are isolated from ordinary use and roll off under provider or contractual retention schedules unless preservation is legally required.</span>
            </div>
          </div>
          <p>
            Charlotte retains student personal information only while it has an educational, account,
            security, support, contractual, or legal reason to do so. Verified deletion requests are
            evaluated against the school&apos;s control of the education record, the student&apos;s use across
            multiple classes, active security investigations, legal holds, and backup limitations.
            Charlotte does not keep deleted information in active systems merely to build a commercial
            profile or to advertise to a student.
          </p>
        </section>

        <section className="panel privacy-section" id="family-rights">
          <div className="privacy-section-heading">
            <UsersRound size={25} />
            <div>
              <div className="eyebrow">Questions and requests</div>
              <h2>School, parent, guardian, and eligible-student choices</h2>
            </div>
          </div>
          <p>
            The school generally controls school-created education records and is usually the best first
            contact for a parent, guardian, or eligible student who wants to understand the school&apos;s use of
            Charlotte. Depending on applicable law and the school&apos;s policies, a parent, guardian, or
            eligible student may ask the school to inspect, obtain, correct, or delete relevant records or
            to explain the school&apos;s authorization for use of the service. Charlotte will assist the school
            with a verified request as required by the applicable agreement and law.
          </p>
          <p>
            A direct request to Charlotte should identify the school, teacher, classroom, student account
            email, and type of request, but should not include a password, classroom recovery key, medical
            record, identity document, or unnecessary student information. Charlotte may need to verify the
            requester and coordinate with the school before disclosing or changing a school-controlled
            record. That verification protects the student from an unauthorized person requesting access.
          </p>
          <h3>School authorization and children under 13</h3>
          <p>
            Charlotte is intended for educational use authorized and directed by a school, district, or
            teacher acting within school policy. Schools are responsible for determining whether they can
            authorize the service, providing any notices, obtaining any consent that their circumstances
            require, and ensuring that teachers use only approved student information. School authorization
            for a child under 13 must be limited to the educational context and cannot authorize an unrelated
            commercial use of the child&apos;s information. If a school cannot provide the required authorization,
            it should not enroll the student until the appropriate permission is obtained.
          </p>
          <p>
            This product notice does not replace a school&apos;s FERPA annual notice, acceptable-use policy,
            parental consent form, student-data privacy agreement, records-request process, or any notice
            required by state or local law. FERPA rights are administered through the educational agency or
            institution. Families can learn more from the U.S. Department of Education&apos;s{` `}
            <a href="https://studentprivacy.ed.gov/faq/what-ferpa" target="_blank" rel="noreferrer">FERPA overview</a>
            {` `}and the Federal Trade Commission&apos;s{` `}
            <a href="https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions" target="_blank" rel="noreferrer">COPPA guidance</a>.
          </p>
        </section>

        <section className="panel privacy-section">
          <div className="privacy-section-heading">
            <ShieldCheck size={25} />
            <div>
              <div className="eyebrow">Shared responsibility</div>
              <h2>What schools and teachers should do</h2>
            </div>
          </div>
          <ul className="privacy-wide-list">
            <li>Obtain district or school approval before enrolling students or uploading school records.</li>
            <li>Provide families with the notices and choices required by school policy and applicable law.</li>
            <li>Enter only the minimum student name and email information needed for enrollment.</li>
            <li>Do not upload district IDs, medical details, IEPs, disciplinary information, family information, or passwords from another system.</li>
            <li>Review roster spreadsheets before using AI-assisted import and remove columns Charlotte does not need.</li>
            <li>Use non-identifying classroom and assignment titles where practical.</li>
            <li>Review AI-generated questions, answers, explanations, rubrics, and summaries before relying on them.</li>
            <li>Review student safety flags promptly and follow school escalation, mandated-reporting, and emergency procedures.</li>
            <li>Store each classroom recovery key in a school-approved password manager or similarly secure location.</li>
            <li>Do not email, post publicly, or place a classroom recovery key in an assignment or student message.</li>
            <li>Delete obsolete classes and materials rather than leaving them archived indefinitely.</li>
            <li>Promptly notify Charlotte of an unauthorized disclosure, lost account, or suspected security incident.</li>
          </ul>
        </section>

        <section className="panel privacy-section">
          <div className="privacy-section-heading">
            <Mail size={25} />
            <div>
              <div className="eyebrow">Contact</div>
              <h2>Privacy questions, requests, and concerns</h2>
            </div>
          </div>
          <p>
            For a privacy question, a verified access/correction/deletion request, or a suspected privacy
            or security issue, contact the school first when the matter concerns a school-controlled student
            record. Charlotte can also be reached at{` `}
            <a href="mailto:hello@charlottelearning.ai">hello@charlottelearning.ai</a>.
          </p>
          <p>
            Charlotte may update this notice when the product, providers, legal requirements, or data
            practices change. Material changes will be reflected by a new effective date and, where
            appropriate, communicated to schools so they can provide any additional notice or choice that
            applies to their community.
          </p>
        </section>
      </main>
    </>
  );
}
