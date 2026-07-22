"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Copy,
  Database,
  Gauge,
  KeyRound,
  LineChart,
  LogOut,
  MailPlus,
  MessageSquareText,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCog,
  UsersRound
} from "lucide-react";
import {
  createAdminInvite,
  logoutAdmin,
  revokeAdminAccess,
  updateFeedbackPasscode
} from "@/app/admin/actions";
import type { AdminMetrics } from "@/lib/admin-metrics";

type AdminIdentity = {
  name: string;
  email: string;
  username: string;
  role: string;
};

export type AdminView = "dashboard" | "analytics" | "people" | "feedback" | "settings";

type InviteFlash = {
  email: string;
  link: string;
  sent: boolean;
  message: string;
} | null;

const numberFormat = new Intl.NumberFormat("en-US");

function formatNumber(value: number) {
  return numberFormat.format(value);
}

function maxValue(items: Array<{ value: number }>) {
  return Math.max(1, ...items.map((item) => item.value));
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone = "blue"
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  detail: string;
  tone?: "blue" | "green" | "orange" | "violet";
}) {
  return (
    <article className={`admin-stat-card ${tone}`}>
      <span>{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{typeof value === "number" ? formatNumber(value) : value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function MiniBarChart({
  title,
  subtitle,
  items,
  tone
}: {
  title: string;
  subtitle: string;
  items: Array<{ label: string; value: number }>;
  tone: "blue" | "green" | "orange";
}) {
  const max = maxValue(items);
  return (
    <section className="admin-glass-panel admin-chart-card">
      <div className="admin-card-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <BarChart3 size={20} />
      </div>
      <div className="admin-bar-chart">
        {items.map((item) => (
          <div className="admin-bar-item" key={item.label}>
            <span>{item.value}</span>
            <i
              className={tone}
              style={{ height: `${Math.max(4, Math.round((item.value / max) * 100))}%` }}
            />
            <small>{item.label}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function LinePanel({ metrics }: { metrics: AdminMetrics }) {
  const sessions = metrics.charts.sessions;
  const students = metrics.charts.students;
  const max = Math.max(1, ...sessions.map((item) => item.value), ...students.map((item) => item.value));
  const width = 640;
  const height = 210;
  const pointsFor = (items: Array<{ value: number }>) =>
    items
      .map((item, index) => {
        const x = sessions.length <= 1 ? 0 : (index / (sessions.length - 1)) * width;
        const y = height - (item.value / max) * (height - 26) - 13;
        return `${x},${y}`;
      })
      .join(" ");

  return (
    <section className="admin-glass-panel admin-line-card">
      <div className="admin-card-head">
        <div>
          <h2>Growth pulse</h2>
          <p>Student sessions and new student records over the last 14 days.</p>
        </div>
        <LineChart size={20} />
      </div>
      <div className="admin-line-wrap">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Growth pulse line chart">
          <defs>
            <linearGradient id="adminLineA" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#8fb3c8" />
              <stop offset="100%" stopColor="#78a89b" />
            </linearGradient>
            <linearGradient id="adminLineB" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#b98b64" />
              <stop offset="100%" stopColor="#b8a35c" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((line) => (
            <line
              key={line}
              x1="0"
              x2={width}
              y1={(line / 3) * height}
              y2={(line / 3) * height}
              className="admin-grid-line"
            />
          ))}
          <polyline className="admin-line sessions" points={pointsFor(sessions)} />
          <polyline className="admin-line students" points={pointsFor(students)} />
        </svg>
      </div>
      <div className="admin-chart-legend">
        <span><i className="sessions" /> Sessions</span>
        <span><i className="students" /> New students</span>
      </div>
    </section>
  );
}

function GaugePanel({ metrics }: { metrics: AdminMetrics }) {
  const completion = metrics.headline.completionRate;
  const correct = metrics.headline.correctRate;
  const firstTry = metrics.headline.firstTryRate;
  return (
    <section className="admin-glass-panel">
      <div className="admin-card-head">
        <div>
          <h2>Learning quality</h2>
          <p>Signals investors can understand quickly.</p>
        </div>
        <Gauge size={20} />
      </div>
      <div className="admin-gauge-grid">
        {[
          ["Completion", completion, "#6ea889"],
          ["Accuracy", correct, "#7da8bd"],
          ["First try", firstTry, "#b98658"]
        ].map(([label, value, color]) => (
          <div className="admin-gauge" key={String(label)}>
            <div
              style={{
                background: `conic-gradient(${color} ${value as number}%, rgba(255,255,255,.08) 0)`
              }}
            >
              <strong>{value}%</strong>
            </div>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function DataTables({ metrics }: { metrics: AdminMetrics }) {
  return (
    <section className="admin-dashboard-grid two">
      <div className="admin-glass-panel">
        <div className="admin-card-head">
          <div>
            <h2>Classroom traction</h2>
            <p>Top classes by roster and usage.</p>
          </div>
          <Database size={20} />
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Teacher</th>
                <th>Students</th>
                <th>Sessions</th>
              </tr>
            </thead>
            <tbody>
              {metrics.topClassrooms.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.name}</strong>
                    <span>{row.gradeLevel} - {row.assignments} assignments</span>
                  </td>
                  <td>{row.teacher}</td>
                  <td>{row.students}</td>
                  <td>{row.sessions}</td>
                </tr>
              ))}
              {metrics.topClassrooms.length === 0 && (
                <tr><td colSpan={4}>No classes yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-glass-panel">
        <div className="admin-card-head">
          <div>
            <h2>Live activity</h2>
            <p>New events appear as the dashboard refreshes.</p>
          </div>
          <Activity size={20} />
        </div>
        <div className="admin-activity-list">
          {metrics.activityTimeline.map((item) => (
            <div className="admin-activity-item" key={`${item.label}-${item.timestamp}`}>
              <i />
              <div>
                <strong>{item.label}</strong>
                <span>{item.time}</span>
              </div>
            </div>
          ))}
          {metrics.activityTimeline.length === 0 && <p>No recent activity yet.</p>}
        </div>
      </div>
    </section>
  );
}

function InviteAndSettings({
  metrics,
  inviteFlash
}: {
  metrics: AdminMetrics;
  inviteFlash: InviteFlash;
}) {
  return (
    <section className="admin-dashboard-grid two">
      <AdminInvitePanel inviteFlash={inviteFlash} />
      <FeedbackSettingsPanel metrics={metrics} />
    </section>
  );
}

function AdminInvitePanel({ inviteFlash }: { inviteFlash: InviteFlash }) {
  const [copied, setCopied] = useState(false);

  async function copyInvite() {
    if (!inviteFlash?.link) return;
    await navigator.clipboard.writeText(inviteFlash.link);
    setCopied(true);
  }

  return (
    <div className="admin-glass-panel">
      <div className="admin-card-head">
        <div>
          <h2>Invite admin</h2>
          <p>Add someone trusted to help monitor demos and investor metrics.</p>
        </div>
        <MailPlus size={20} />
      </div>
      {inviteFlash && (
        <div className={`admin-invite-flash ${inviteFlash.sent ? "sent" : "manual"}`}>
          <strong>{inviteFlash.message}</strong>
          <p>{inviteFlash.email}</p>
          <div>
            <input readOnly value={inviteFlash.link} />
            <button className="admin-icon-button" type="button" onClick={copyInvite} aria-label="Copy invite link">
              {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
            </button>
          </div>
        </div>
      )}
      <form className="admin-form" action={createAdminInvite}>
        <label>
          Name
          <input name="name" maxLength={120} placeholder="Optional" />
        </label>
        <label>
          Email
          <input name="email" type="email" maxLength={254} required placeholder="admin@school.org" />
        </label>
        <button className="admin-primary-button" type="submit">
          <MailPlus size={18} />
          Send invite
        </button>
      </form>
    </div>
  );
}

function FeedbackSettingsPanel({ metrics }: { metrics: AdminMetrics }) {
  return (
    <div className="admin-glass-panel">
      <div className="admin-card-head">
        <div>
          <h2>Feedback passcode</h2>
          <p>Teachers use this to open the weekly feedback form from the homepage footer.</p>
        </div>
        <KeyRound size={20} />
      </div>
      <div className="admin-passcode-status">
        <ShieldCheck size={18} />
        {metrics.settings.configured ? "Feedback passcode is active." : "Set a passcode before sharing feedback."}
        {metrics.settings.hint ? <span>Hint: {metrics.settings.hint}</span> : null}
      </div>
      <form className="admin-form" action={updateFeedbackPasscode}>
        <label>
          New passcode
          <input name="passcode" minLength={6} maxLength={120} required placeholder="Example: week1-demo" />
        </label>
        <label>
          Teacher hint
          <input name="hint" maxLength={120} placeholder="Optional hint you can recognize" />
        </label>
        <button className="admin-primary-button green" type="submit">
          <Settings size={18} />
          Save passcode
        </button>
      </form>
    </div>
  );
}

function FeedbackPanel({ metrics }: { metrics: AdminMetrics }) {
  return (
    <section className="admin-glass-panel" id="feedback">
      <div className="admin-card-head">
        <div>
          <h2>Weekly teacher feedback</h2>
          <p>Qualitative context for product decisions and investor updates.</p>
        </div>
        <MessageSquareText size={20} />
      </div>
      <div className="admin-feedback-grid">
        {metrics.feedback.map((item) => (
          <article className="admin-feedback-card" key={item.id}>
            <div>
              <strong>{item.teacherName}</strong>
              <span>{item.schoolOrClass || "Classroom not listed"} - {item.time}</span>
            </div>
            <em>{item.rating}/5</em>
            <p><b>Going well:</b> {item.strengths}</p>
            <p><b>Struggling:</b> {item.struggles}</p>
            <p><b>Wanted:</b> {item.improvements}</p>
          </article>
        ))}
        {metrics.feedback.length === 0 && <p>No teacher feedback submitted yet.</p>}
      </div>
    </section>
  );
}

function PeoplePanel({
  metrics,
  admin
}: {
  metrics: AdminMetrics;
  admin: AdminIdentity;
}) {
  const isOwner = admin.role === "OWNER";

  return (
    <section className="admin-dashboard-grid two" id="people">
      <div className="admin-glass-panel">
        <div className="admin-card-head">
          <div>
            <h2>People with admin access</h2>
            <p>Owner controls stay here so access is easy to audit.</p>
          </div>
          <UserCog size={20} />
        </div>
        <div className="admin-people-list">
          {metrics.admins.map((person) => {
            const isSelf = person.username === admin.username;
            const canRevoke = isOwner && person.role !== "OWNER" && !isSelf;
            return (
              <article className="admin-person-card" key={person.id}>
                <div>
                  <strong>{person.name}</strong>
                  <span>{person.email}</span>
                  <small>@{person.username}</small>
                </div>
                <em className={`admin-role-pill ${person.role.toLowerCase()}`}>{person.role}</em>
                {canRevoke ? (
                  <form action={revokeAdminAccess}>
                    <input type="hidden" name="adminId" value={person.id} />
                    <button className="admin-danger-button" type="submit">
                      Revoke
                    </button>
                  </form>
                ) : (
                  <span className="admin-access-note">
                    {isSelf ? "You" : person.role === "OWNER" ? "Protected" : "Owner only"}
                  </span>
                )}
              </article>
            );
          })}
        </div>
      </div>

      <div className="admin-glass-panel">
        <div className="admin-card-head">
          <div>
            <h2>Admin invitations</h2>
            <p>Recent invite status for your access pipeline.</p>
          </div>
          <MailPlus size={20} />
        </div>
        <div className="admin-people-list">
          {metrics.invites.map((invite) => (
            <article className="admin-person-card invite" key={invite.id}>
              <div>
                <strong>{invite.name || invite.email}</strong>
                <span>{invite.email}</span>
                <small>Invited by {invite.invitedBy}</small>
              </div>
              <em className={`admin-role-pill ${
                invite.used ? "used" : invite.expired ? "expired" : invite.sent ? "sent" : "manual"
              }`}>
                {invite.used ? "USED" : invite.expired ? "EXPIRED" : invite.sent ? "SENT" : "LINK"}
              </em>
            </article>
          ))}
          {metrics.invites.length === 0 && <p>No admin invitations yet.</p>}
        </div>
      </div>
    </section>
  );
}

export function AdminDashboardClient({
  initialMetrics,
  admin,
  inviteFlash,
  view = "dashboard"
}: {
  initialMetrics: AdminMetrics;
  admin: AdminIdentity;
  inviteFlash: InviteFlash;
  view?: AdminView;
}) {
  const [metrics, setMetrics] = useState(initialMetrics);
  const [lastUpdated, setLastUpdated] = useState(new Date(initialMetrics.generatedAt));
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function refresh() {
      try {
        setRefreshing(true);
        const response = await fetch("/api/admin/metrics", { cache: "no-store" });
        if (!response.ok) return;
        const next = await response.json() as AdminMetrics;
        if (!mounted) return;
        setMetrics(next);
        setLastUpdated(new Date(next.generatedAt));
      } finally {
        if (mounted) setRefreshing(false);
      }
    }

    const timer = window.setInterval(refresh, 8000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const gradeBars = useMemo(() => metrics.charts.gradeMix.slice(0, 8), [metrics]);
  const title = {
    dashboard: "Main Dashboard",
    analytics: "Analytics",
    people: "People",
    feedback: "Feedback",
    settings: "Settings"
  }[view];
  const subtitle = {
    dashboard: "Live product, classroom, learning, and feedback metrics for Charlotte AI.",
    analytics: "Trends, learning quality, grade mix, and classroom traction.",
    people: "Admin access, owner controls, and invite history.",
    feedback: "Weekly teacher feedback and product notes.",
    settings: "Feedback passcode and operational controls."
  }[view];

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <img src="/images/charlotte-ai-logo.png" alt="" />
          <span>Charlotte Admin</span>
        </div>
        <nav aria-label="Admin sections">
          <a href="/admin" className={view === "dashboard" ? "active" : ""}><Gauge size={19} /> Dashboard</a>
          <a href="/admin/analytics" className={view === "analytics" ? "active" : ""}><BarChart3 size={19} /> Analytics</a>
          <a href="/admin/people" className={view === "people" ? "active" : ""}><UsersRound size={19} /> People</a>
          <a href="/admin/feedback" className={view === "feedback" ? "active" : ""}><MessageSquareText size={19} /> Feedback</a>
          <a href="/admin/settings" className={view === "settings" ? "active" : ""}><Settings size={19} /> Settings</a>
        </nav>
        <div className="admin-profile">
          <strong>{admin.name}</strong>
          <span>{admin.role.toLowerCase()} - @{admin.username}</span>
        </div>
        <form action={logoutAdmin}>
          <button className="admin-sidebar-button" type="submit">
            <LogOut size={18} />
            Log out
          </button>
        </form>
      </aside>

      <section className="admin-main" id="dashboard">
        <div className="admin-hero">
          <div>
            <div className="admin-breadcrumb">Pages / {title}</div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className={`admin-live-pill ${refreshing ? "refreshing" : ""}`}>
            <span />
            Live - updated {lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </div>
        </div>

        {view === "dashboard" && (
          <>
            <section className="admin-stat-grid">
              <MetricCard icon={<UsersRound size={24} />} label="Active users" value={metrics.headline.totalActiveUsers} detail={`${metrics.headline.activeTeachers} teachers - ${metrics.headline.activeStudents} students in 7d`} tone="green" />
              <MetricCard icon={<ClipboardList size={24} />} label="Classes created" value={metrics.headline.totalClasses} detail={`${metrics.headline.archivedClasses} archived`} />
              <MetricCard icon={<Sparkles size={24} />} label="Assignments" value={metrics.headline.totalMaterials} detail={`${metrics.headline.publishedMaterials} published - ${metrics.headline.homeMaterials} home`} tone="violet" />
              <MetricCard icon={<Activity size={24} />} label="Sessions today" value={metrics.headline.todaySessions} detail={`${metrics.headline.todayAnswers} answers submitted today`} tone="orange" />
            </section>
            <section className="admin-dashboard-grid main">
              <LinePanel metrics={metrics} />
              <GaugePanel metrics={metrics} />
            </section>
            <DataTables metrics={metrics} />
          </>
        )}

        {view === "analytics" && (
          <>
            <section className="admin-dashboard-grid main">
              <LinePanel metrics={metrics} />
              <GaugePanel metrics={metrics} />
            </section>
            <section className="admin-dashboard-grid three">
              <MiniBarChart title="New teachers" subtitle="Last 14 days" items={metrics.charts.teachers} tone="blue" />
              <MiniBarChart title="New classes" subtitle="Last 14 days" items={metrics.charts.classes} tone="green" />
              <MiniBarChart title="Grade mix" subtitle="Active classrooms" items={gradeBars} tone="orange" />
            </section>
            <section className="admin-stat-grid compact">
              <MetricCard icon={<UsersRound size={22} />} label="Teachers" value={metrics.headline.totalTeachers} detail="Accounts created" />
              <MetricCard icon={<UsersRound size={22} />} label="Student accounts" value={metrics.headline.totalStudentAccounts} detail={`${metrics.headline.totalStudents} active roster rows`} tone="green" />
              <MetricCard icon={<CheckCircle2 size={22} />} label="Completed sessions" value={metrics.headline.completedSessions} detail={`${metrics.headline.completionRate}% completion rate`} tone="violet" />
              <MetricCard icon={<MessageSquareText size={22} />} label="Feedback notes" value={metrics.headline.feedbackCount} detail={`${metrics.headline.contactLeads} contact leads`} tone="orange" />
            </section>
          </>
        )}

        {view === "people" && (
          <>
            <PeoplePanel metrics={metrics} admin={admin} />
            <section className="admin-dashboard-grid two">
              <AdminInvitePanel inviteFlash={inviteFlash} />
            </section>
          </>
        )}

        {view === "feedback" && <FeedbackPanel metrics={metrics} />}

        {view === "settings" && (
          <section className="admin-dashboard-grid two">
            <FeedbackSettingsPanel metrics={metrics} />
            <AdminInvitePanel inviteFlash={inviteFlash} />
          </section>
        )}
      </section>
    </main>
  );
}
