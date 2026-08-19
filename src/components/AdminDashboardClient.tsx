"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  ClipboardList,
  Cloud,
  Copy,
  Database,
  DollarSign,
  Gauge,
  Gamepad2,
  Inbox,
  KeyRound,
  LineChart,
  LogOut,
  MailPlus,
  MessageSquareText,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  Terminal,
  UserCog,
  UsersRound
} from "lucide-react";
import {
  createAdminInvite,
  logoutAdmin,
  revokeAdminAccess,
  revokeAdminInvite,
  updateLeadStatus,
  updateFeedbackPasscode
} from "@/app/admin/actions";
import type { AdminMetrics } from "@/lib/admin-metrics";
import type { OpenAiUsageMetrics } from "@/lib/openai-usage";
import type { VercelServerMetrics } from "@/lib/vercel-monitoring";

type AdminIdentity = {
  name: string;
  email: string;
  username: string;
  role: string;
};

export type AdminView = "dashboard" | "analytics" | "leads" | "people" | "feedback" | "settings" | "server" | "ai-usage";

type InviteFlash = {
  inviteId: string;
  email: string;
  link: string;
  sent: boolean;
  message: string;
} | null;

const numberFormat = new Intl.NumberFormat("en-US");
const compactNumberFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1
});

const leadStatusOptions = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "CONVERTED", label: "Converted" },
  { value: "CLOSED", label: "Closed" }
] as const;

function formatNumber(value: number) {
  return numberFormat.format(value);
}

function formatCompact(value: number) {
  return compactNumberFormat.format(value);
}

function formatCurrency(value: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: value < 1 ? 4 : 2
  }).format(value);
}

function formatDateTime(value?: string) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getFullYear() < 2000) return "Unknown";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
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
        <strong className="admin-metric-value" key={String(value)}>{typeof value === "number" ? formatNumber(value) : value}</strong>
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
  const students = metrics.charts.activeStudents;
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
          <p>Student participation and completed learning sessions over the last 14 days.</p>
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
        <span><i className="students" /> Active students</span>
      </div>
    </section>
  );
}

function MonthlyScorePanel({ metrics }: { metrics: AdminMetrics }) {
  const months = metrics.monthlyClassScores;
  const current = months[months.length - 1];
  const previous = months[months.length - 2];
  const change = current?.average !== null && current?.average !== undefined && previous?.average !== null && previous?.average !== undefined
    ? current.average - previous.average
    : null;
  return (
    <section className="admin-glass-panel">
      <div className="admin-card-head">
        <div>
          <h2>Monthly class score</h2>
          <p>Each assignment&apos;s class average is weighted equally.</p>
        </div>
        <LineChart size={20} />
      </div>
      <div className="admin-month-score-summary">
        <div>
          <span>{current?.label ?? "This month"}</span>
          <strong>{current?.average === null || current?.average === undefined ? "—" : `${current.average}%`}</strong>
          <small>
            {current?.assignmentCount ?? 0} assignments · {current?.scoredAssignmentCount ?? 0} with scores
          </small>
        </div>
        <span className={`admin-month-change ${change === null ? "neutral" : change >= 0 ? "up" : "down"}`}>
          {change === null ? "No prior comparison" : `${change >= 0 ? "+" : ""}${change} pts vs ${previous.shortLabel}`}
        </span>
      </div>
      <div className="admin-month-score-bars" aria-label="Monthly class average scores">
        {months.map((month) => (
          <div key={month.key}>
            <span>{month.average === null ? "—" : `${month.average}%`}</span>
            <i style={{ height: `${Math.max(4, month.average ?? 0)}%` }} />
            <small>{month.shortLabel}</small>
            <em>{month.assignmentCount} asg.</em>
          </div>
        ))}
      </div>
    </section>
  );
}

function DataTables({ metrics }: { metrics: AdminMetrics }) {
  return (
    <section className="admin-dashboard-grid">
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
                    <a className="admin-class-link" href={`/admin/classes/${row.id}`}>
                      <strong>{row.name}</strong>
                      <span>{row.gradeLevel} - {row.assignments} assignments</span>
                    </a>
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

    </section>
  );
}

function SchoolAnalyticsPanel({ metrics }: { metrics: AdminMetrics }) {
  const [schoolId, setSchoolId] = useState("all");
  const schools = schoolId === "all"
    ? metrics.schoolAnalytics
    : metrics.schoolAnalytics.filter((school) => school.id === schoolId);
  return (
    <section className="admin-glass-panel admin-school-analytics">
      <div className="admin-card-head">
        <div><h2>School analytics</h2><p>Compare adoption, participation, and learning activity by school.</p></div>
        <label className="admin-school-filter">School
          <select value={schoolId} onChange={(event) => setSchoolId(event.target.value)}>
            <option value="all">All schools</option>
            {metrics.schoolAnalytics.map((school) => <option value={school.id} key={school.id}>{school.name}</option>)}
          </select>
        </label>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table admin-school-table">
          <thead><tr><th>School</th><th>Teachers</th><th>Classes</th><th>Active students</th><th>Participation</th><th>Completed</th><th>Accuracy</th></tr></thead>
          <tbody>
            {schools.map((school) => (
              <tr key={school.id}>
                <td><strong>{school.name}</strong><span>{school.districtName || school.classroomNames.join(", ") || "No classes yet"}</span></td>
                <td>{school.teachers}</td>
                <td>{school.classes}</td>
                <td>{school.activeStudents} / {school.enrolledStudents}</td>
                <td>{school.enrolledStudents ? Math.round((school.activeStudents / school.enrolledStudents) * 100) : 0}%</td>
                <td>{school.homeActivitiesCompleted} practice - {school.gamesCompleted} games</td>
                <td>{school.averageAccuracy}%</td>
              </tr>
            ))}
            {!schools.length && <tr><td colSpan={7}>No schools have been onboarded yet.</td></tr>}
          </tbody>
        </table>
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
      <AdminInvitePanel />
      <FeedbackSettingsPanel metrics={metrics} />
    </section>
  );
}

function AdminInvitePanel() {
  return (
    <div className="admin-glass-panel">
      <div className="admin-card-head">
        <div>
          <h2>Invite admin</h2>
          <p>Add someone trusted to help monitor demos and investor metrics.</p>
        </div>
        <MailPlus size={20} />
      </div>
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

function AuditPanel({ metrics }: { metrics: AdminMetrics }) {
  return (
    <section className="admin-glass-panel" style={{ marginTop: 18 }}>
      <div className="admin-card-head">
        <div>
          <h2>Audit and email delivery log</h2>
          <p>Recent account, classroom, destructive-action, and outbound-email events.</p>
        </div>
        <ClipboardList size={20} />
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Event</th>
              <th>Actor</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {metrics.auditEvents.map((event) => (
              <tr key={event.id}>
                <td>{formatDateTime(event.createdAt)}</td>
                <td><strong>{event.action.replace(/[._]/g, " ")}</strong></td>
                <td>{event.actorType}{event.actorId ? ` · ${event.actorId.slice(0, 8)}` : ""}</td>
                <td>{event.targetType}{event.targetId ? ` · ${event.targetId.slice(0, 8)}` : ""}</td>
              </tr>
            ))}
            {metrics.auditEvents.length === 0 && (
              <tr><td colSpan={4}>No audit events recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="admin-table-wrap" style={{ marginTop: 18 }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Email</th>
              <th>Status</th>
              <th>Reference</th>
            </tr>
          </thead>
          <tbody>
            {metrics.emailDeliveries.map((delivery) => (
              <tr key={delivery.id}>
                <td>{formatDateTime(delivery.sentAt || delivery.createdAt)}</td>
                <td><strong>{delivery.kind.replace(/_/g, " ").toLowerCase()}</strong></td>
                <td>{delivery.status}{delivery.errorCode ? ` · ${delivery.errorCode}` : ""}</td>
                <td>{(delivery.classroomId || delivery.teacherId || delivery.studentId || delivery.id).slice(0, 8)}</td>
              </tr>
            ))}
            {metrics.emailDeliveries.length === 0 && (
              <tr><td colSpan={4}>No email deliveries recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
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

function LeadsPanel({ metrics }: { metrics: AdminMetrics }) {
  const [leads, setLeads] = useState(metrics.leads);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  useEffect(() => setLeads(metrics.leads), [metrics.generatedAt, metrics.leads]);
  const newLeads = leads.filter((lead) => lead.status === "NEW").length;
  const activeLeads = leads.filter((lead) => (
    lead.status === "CONTACTED" || lead.status === "QUALIFIED"
  )).length;
  const convertedLeads = leads.filter((lead) => lead.status === "CONVERTED").length;

  async function changeStatus(leadId: string, status: typeof leadStatusOptions[number]["value"]) {
    const previous = leads;
    setUpdatingId(leadId);
    setLeads((items) => items.map((lead) => lead.id === leadId ? { ...lead, status } : lead));
    const formData = new FormData();
    formData.set("leadId", leadId);
    formData.set("status", status);
    try {
      await updateLeadStatus(formData);
    } catch {
      setLeads(previous);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <>
      <section className="admin-stat-grid compact">
        <MetricCard icon={<Inbox size={22} />} label="Total leads" value={leads.length} detail="Requests currently retained" />
        <MetricCard icon={<MailPlus size={22} />} label="New" value={newLeads} detail="Waiting for first contact" tone="orange" />
        <MetricCard icon={<Activity size={22} />} label="In progress" value={activeLeads} detail="Contacted or qualified" tone="blue" />
        <MetricCard icon={<CheckCircle2 size={22} />} label="Converted" value={convertedLeads} detail="Moved forward successfully" tone="green" />
      </section>

      <section className="admin-glass-panel admin-leads-panel">
        <div className="admin-card-head">
          <div>
            <h2>Leads</h2>
            <p>Classroom-plan requests submitted through the public contact form.</p>
          </div>
          <Inbox size={20} />
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table admin-leads-table">
            <thead>
              <tr>
                <th>Contact</th>
                <th>School</th>
                <th>Grade</th>
                <th>Received</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <div className="admin-lead-contact">
                      <strong>{lead.name}</strong>
                      <a href={`mailto:${lead.email}`}>{lead.email}</a>
                      {lead.phone ? <a href={`tel:${lead.phone}`}>{lead.phone}</a> : null}
                    </div>
                  </td>
                  <td>{lead.school || "Not provided"}</td>
                  <td>{lead.gradeLevel}</td>
                  <td>
                    <strong>{lead.time}</strong>
                    <span>{formatDateTime(lead.createdAt)}</span>
                  </td>
                  <td>
                    <div className="admin-lead-status-form">
                      <select
                        aria-label={`Status for ${lead.name}`}
                        className={`admin-lead-status ${lead.status.toLowerCase()}`}
                        value={lead.status}
                        disabled={updatingId === lead.id}
                        onChange={(event) => void changeStatus(lead.id, event.target.value as typeof leadStatusOptions[number]["value"])}
                      >
                        {leadStatusOptions.map((status) => (
                          <option key={status.value} value={status.value}>{status.label}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr><td colSpan={5}>No contact requests have been submitted yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function PeoplePanel({
  metrics,
  admin,
  inviteFlash
}: {
  metrics: AdminMetrics;
  admin: AdminIdentity;
  inviteFlash: InviteFlash;
}) {
  const isOwner = admin.role === "OWNER";
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  async function copyInviteLink(inviteId: string, link: string) {
    await navigator.clipboard.writeText(link);
    setCopiedInviteId(inviteId);
  }

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
            <p>Pending invitations. Used, expired, and revoked invitations are removed.</p>
          </div>
          <MailPlus size={20} />
        </div>
        <div className="admin-people-list">
          {metrics.invites.map((invite) => {
            const inviteLink = inviteFlash?.inviteId === invite.id ? inviteFlash.link : null;
            return (
              <article className="admin-person-card invite" key={invite.id}>
                <div className="admin-person-details">
                  <strong>{invite.name || invite.email}</strong>
                  <span>{invite.email}</span>
                  <small>Invited by {invite.invitedBy}</small>
                  {inviteLink && (
                    <div className="admin-invite-link">
                      <span>{inviteLink}</span>
                      <button
                        className="admin-icon-button"
                        type="button"
                        onClick={() => copyInviteLink(invite.id, inviteLink)}
                        aria-label={`Copy invite link for ${invite.name || invite.email}`}
                        title="Copy invite link"
                      >
                        {copiedInviteId === invite.id ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                      </button>
                    </div>
                  )}
                </div>
                <em className={`admin-role-pill ${invite.sent ? "sent" : "manual"}`}>
                  {invite.sent ? "SENT" : "LINK"}
                </em>
                {isOwner && (
                  <form
                    action={revokeAdminInvite}
                    onSubmit={(event) => {
                      if (!window.confirm("Revoke this invitation? Their link will stop working immediately.")) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <input type="hidden" name="inviteId" value={invite.id} />
                    <button className="admin-danger-button" type="submit">
                      Revoke
                    </button>
                  </form>
                )}
              </article>
            );
          })}
          {metrics.invites.length === 0 && <p>No active admin invitations.</p>}
        </div>
      </div>
    </section>
  );
}

function ProviderSetupCard({
  title,
  message,
  variables
}: {
  title: string;
  message?: string;
  variables: string[];
}) {
  return (
    <section className="admin-glass-panel admin-provider-setup">
      <div className="admin-card-head">
        <div>
          <h2>{title}</h2>
          <p>{message || "Connect the provider token in production to unlock this page."}</p>
        </div>
        <Terminal size={20} />
      </div>
      <div className="admin-setup-list">
        {variables.map((variable) => (
          <code key={variable}>{variable}</code>
        ))}
      </div>
      <p className="admin-provider-note">
        These values stay server-side. The browser only receives the summarized dashboard data.
      </p>
    </section>
  );
}

function ProviderAlert({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="admin-provider-alert">
      <AlertTriangle size={17} />
      <span>{message}</span>
    </div>
  );
}

function ServerPanel({
  metrics,
  platform,
  aiMetrics
}: {
  metrics?: VercelServerMetrics;
  platform: AdminMetrics;
  aiMetrics?: OpenAiUsageMetrics;
}) {
  const failedDeployments = metrics?.headline.failedDeployments || 0;
  const systemTone = failedDeployments > 0 ? "warning" : "operational";
  const lastCheck = metrics?.generatedAt || platform.generatedAt;
  return (
    <>
      <section className="admin-system-status-grid">
        <article className={`admin-system-status ${systemTone}`}><span><Server size={22} /></span><div><small>Current system status</small><strong>{systemTone === "operational" ? "Operational" : "Warning"}</strong><p>{failedDeployments ? `${failedDeployments} recent deployment issue${failedDeployments === 1 ? "" : "s"}` : "Charlotte is serving normally."}</p></div></article>
        <article className="admin-system-status operational"><span><Database size={22} /></span><div><small>Database</small><strong>Operational</strong><p>Classroom and account data loaded successfully.</p></div></article>
        <article className={`admin-system-status ${aiMetrics?.configured ? "operational" : "warning"}`}><span><Bot size={22} /></span><div><small>AI service</small><strong>{aiMetrics?.configured ? "Operational" : "Warning"}</strong><p>{aiMetrics?.configured ? "AI usage reporting is connected." : "AI usage reporting is not connected."}</p></div></article>
        <article className="admin-system-status operational"><span><UsersRound size={22} /></span><div><small>Active users</small><strong>{formatNumber(platform.headline.totalActiveUsers)}</strong><p>{platform.headline.activeStudents} students and {platform.headline.activeTeachers} teachers in 7 days.</p></div></article>
      </section>
      <section className="admin-glass-panel admin-issues-panel">
        <div className="admin-card-head"><div><h2>Recent issues</h2><p>Only items that may need attention are shown here.</p></div><AlertTriangle size={20} /></div>
        {metrics?.message && <div className="admin-provider-alert"><AlertTriangle size={17} /><span>{metrics.message}</span></div>}
        {metrics?.deployments.filter((deployment) => /error|fail|cancel/i.test(`${deployment.state} ${deployment.readyState}`)).map((deployment) => (
          <article className="admin-issue-row" key={deployment.id}><i /><div><strong>Deployment issue</strong><span>{deployment.url}</span></div><time>{formatDateTime(deployment.createdAt)}</time></article>
        ))}
        {!metrics?.message && !failedDeployments && <div className="admin-empty-operational"><CheckCircle2 size={22} /><span>No recent system issues.</span></div>}
        <footer>Last system check: {formatDateTime(lastCheck)}</footer>
      </section>
    </>
  );
}

function AiUsageBars({ metrics }: { metrics: OpenAiUsageMetrics }) {
  const maxTokens = Math.max(1, ...metrics.days.map((day) => day.totalTokens));
  return (
    <div className="admin-ops-bars">
      {metrics.days.map((day) => (
        <div className="admin-ops-row" key={day.startTime}>
          <span>{day.label}</span>
          <div>
            <i style={{ width: `${Math.max(2, Math.round((day.totalTokens / maxTokens) * 100))}%` }} />
          </div>
          <strong>{formatCompact(day.totalTokens)}</strong>
          <em>{formatCurrency(day.cost, day.currency)}</em>
        </div>
      ))}
      {metrics.days.length === 0 && <p>No OpenAI usage returned for the last 14 days.</p>}
    </div>
  );
}

function AiUsagePanel({ metrics }: { metrics?: OpenAiUsageMetrics }) {
  if (!metrics?.configured) {
    return (
      <ProviderSetupCard
        title="Connect OpenAI usage"
        message={metrics?.message}
        variables={["OPENAI_ADMIN_KEY", "CHARLOTTE_OPENAI_PROJECT_ID"]}
      />
    );
  }

  return (
    <>
      <ProviderAlert message={metrics.message} />
      <section className="admin-stat-grid">
        <MetricCard icon={<Bot size={22} />} label="Tokens used" value={formatCompact(metrics.headline.totalTokens)} detail={`${formatCompact(metrics.headline.inputTokens)} in - ${formatCompact(metrics.headline.outputTokens)} out`} tone="green" />
        <MetricCard icon={<DollarSign size={22} />} label="OpenAI cost" value={formatCurrency(metrics.headline.totalCost, metrics.headline.currency)} detail={`${formatCurrency(metrics.headline.avgDailyCost, metrics.headline.currency)} avg per day`} tone="orange" />
        <MetricCard icon={<Activity size={22} />} label="Requests" value={metrics.headline.requests} detail="Model requests in the last 14 days" />
        <MetricCard icon={<Sparkles size={22} />} label="Cached tokens" value={formatCompact(metrics.headline.cachedTokens)} detail="Prompt cache savings signal" tone="violet" />
      </section>

      <section className="admin-dashboard-grid main">
        <div className="admin-glass-panel">
          <div className="admin-card-head">
            <div>
              <h2>Token and cost trend</h2>
              <p>Daily OpenAI token volume with cost next to each day.</p>
            </div>
            <BarChart3 size={20} />
          </div>
          <AiUsageBars metrics={metrics} />
        </div>

        <div className="admin-glass-panel">
          <div className="admin-card-head">
            <div>
              <h2>Cost breakdown</h2>
              <p>Largest cost line items from OpenAI.</p>
            </div>
            <DollarSign size={20} />
          </div>
          <div className="admin-provider-list compact">
            {metrics.costItems.map((item) => (
              <article className="admin-provider-item" key={item.label}>
                <i />
                <div>
                  <strong>{item.label}</strong>
                  <span>OpenAI usage line item</span>
                </div>
                <time>{formatCurrency(item.cost, item.currency)}</time>
              </article>
            ))}
            {metrics.costItems.length === 0 && <p>No cost line items returned yet.</p>}
          </div>
        </div>
      </section>

      <section className="admin-glass-panel">
        <div className="admin-card-head">
          <div>
            <h2>Model usage</h2>
            <p>Which models are using the most tokens.</p>
          </div>
          <Bot size={20} />
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Tokens</th>
                <th>Input</th>
                <th>Output</th>
                <th>Requests</th>
              </tr>
            </thead>
            <tbody>
              {metrics.models.map((model) => (
                <tr key={model.model}>
                  <td><strong>{model.model}</strong><span>{formatCompact(model.cachedTokens)} cached input tokens</span></td>
                  <td>{formatCompact(model.totalTokens)}</td>
                  <td>{formatCompact(model.inputTokens)}</td>
                  <td>{formatCompact(model.outputTokens)}</td>
                  <td>{formatNumber(model.requests)}</td>
                </tr>
              ))}
              {metrics.models.length === 0 && (
                <tr><td colSpan={5}>No model usage returned yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export function AdminDashboardClient({
  initialMetrics,
  admin,
  inviteFlash,
  view = "dashboard",
  serverMetrics,
  aiUsageMetrics
}: {
  initialMetrics: AdminMetrics;
  admin: AdminIdentity;
  inviteFlash: InviteFlash;
  view?: AdminView;
  serverMetrics?: VercelServerMetrics;
  aiUsageMetrics?: OpenAiUsageMetrics;
}) {
  const [metrics, setMetrics] = useState(initialMetrics);
  const [serverSnapshot, setServerSnapshot] = useState(serverMetrics);
  const [aiUsageSnapshot, setAiUsageSnapshot] = useState(aiUsageMetrics);
  const [lastUpdated, setLastUpdated] = useState(new Date(initialMetrics.generatedAt));
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let mounted = true;
    let inFlight = false;
    async function refresh() {
      if (inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        setRefreshing(true);
        const response = await fetch("/api/admin/metrics", { cache: "no-store" });
        if (!response.ok) return;
        const next = await response.json() as AdminMetrics;
        if (!mounted) return;
        setMetrics(next);
        setLastUpdated(new Date(next.generatedAt));
      } finally {
        inFlight = false;
        if (mounted) setRefreshing(false);
      }
    }

    const timer = window.setInterval(refresh, 15000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (view !== "server" && view !== "ai-usage") return;
    let mounted = true;
    const url = view === "server" ? "/api/admin/server" : "/api/admin/ai-usage";

    async function refreshProvider() {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok || !mounted) return;
      if (view === "server") {
        setServerSnapshot(await response.json() as VercelServerMetrics);
      } else {
        setAiUsageSnapshot(await response.json() as OpenAiUsageMetrics);
      }
    }

    const timer = window.setInterval(refreshProvider, 15000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [view]);

  const gradeBars = useMemo(() => metrics.charts.gradeMix.slice(0, 8), [metrics]);
  const title = {
    dashboard: "Main Dashboard",
    analytics: "Analytics",
    leads: "Leads",
    people: "People",
    feedback: "Feedback",
    settings: "Settings",
    server: "Server",
    "ai-usage": "AI Usage"
  }[view];
  const subtitle = {
    dashboard: "A current view of adoption, participation, and completed learning across Charlotte AI.",
    analytics: "School-level adoption, student participation, learning quality, and platform usage.",
    leads: "Contact requests, follow-up status, and classroom sales opportunities.",
    people: "Admin access, owner controls, and invite history.",
    feedback: "Weekly teacher feedback and product notes.",
    settings: "Feedback passcode and operational controls.",
    server: "Plain-language health checks for Charlotte's database, AI service, and production app.",
    "ai-usage": "OpenAI token usage, request volume, and cost trends."
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
          <a href="/admin/leads" className={view === "leads" ? "active" : ""}><Inbox size={19} /> Leads</a>
          <a href="/admin/people" className={view === "people" ? "active" : ""}><UsersRound size={19} /> People</a>
          <a href="/admin/feedback" className={view === "feedback" ? "active" : ""}><MessageSquareText size={19} /> Feedback</a>
          <a href="/admin/server" className={view === "server" ? "active" : ""}><Server size={19} /> Server</a>
          <a href="/admin/ai-usage" className={view === "ai-usage" ? "active" : ""}><Bot size={19} /> AI Usage</a>
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
              <MetricCard icon={<UsersRound size={24} />} label="Total Active Users" value={metrics.headline.totalActiveUsers} detail={`${metrics.headline.activeTeachers} teachers - ${metrics.headline.activeStudents} students in 7 days`} tone="green" />
              <MetricCard icon={<ClipboardList size={24} />} label="Total Classes Created" value={metrics.headline.totalClasses} detail={`${metrics.headline.totalClasses - metrics.headline.archivedClasses} currently active`} />
              <MetricCard icon={<UsersRound size={24} />} label="Active Students" value={metrics.headline.activeStudents} detail={`${metrics.headline.participationRate}% of enrolled students active in 7 days`} tone="violet" />
              <MetricCard icon={<BookOpenCheck size={24} />} label="Assignments Completed" value={metrics.headline.assignmentsCompleted} detail="Completed student assignment sessions" tone="orange" />
            </section>
            <section className="admin-dashboard-grid">
              <LinePanel metrics={metrics} />
            </section>
            <DataTables metrics={metrics} />
          </>
        )}

        {view === "analytics" && (
          <>
            <section className="admin-stat-grid">
              <MetricCard icon={<Building2 size={22} />} label="Schools Onboarded" value={metrics.headline.totalSchools} detail="Schools with a Charlotte workspace" />
              <MetricCard icon={<UsersRound size={22} />} label="Total Teachers" value={metrics.headline.totalTeachers} detail="Non-showcase teacher accounts" tone="green" />
              <MetricCard icon={<ClipboardList size={22} />} label="Total Classes" value={metrics.headline.totalClasses} detail={`${metrics.headline.archivedClasses} archived`} tone="violet" />
              <MetricCard icon={<UsersRound size={22} />} label="Active Students" value={metrics.headline.activeStudents} detail={`${metrics.headline.participationRate}% participation in 7 days`} tone="orange" />
            </section>
            <SchoolAnalyticsPanel metrics={metrics} />
            <section className="admin-dashboard-grid" style={{ marginTop: 12 }}><LinePanel metrics={metrics} /></section>
            <section className="admin-dashboard-grid three">
              <MiniBarChart title="New teachers" subtitle="Last 14 days" items={metrics.charts.teachers} tone="blue" />
              <MiniBarChart title="New classes" subtitle="Last 14 days" items={metrics.charts.classes} tone="green" />
              <MiniBarChart title="Grade mix" subtitle="Active classrooms" items={gradeBars} tone="orange" />
            </section>
            <section className="admin-stat-grid compact">
              <MetricCard icon={<Gamepad2 size={22} />} label="Games Completed" value={metrics.headline.completedGames} detail="Finished classroom game rooms" />
              <MetricCard icon={<BookOpenCheck size={22} />} label="Practice Completed" value={metrics.headline.completedHomeActivities} detail="Optional at-home activities completed" tone="green" />
              <MetricCard icon={<CheckCircle2 size={22} />} label="Average Accuracy" value={`${metrics.headline.correctRate}%`} detail={`${metrics.headline.totalAnswers} graded answers`} tone="violet" />
              <MetricCard icon={<Activity size={22} />} label="Platform Participation" value={`${metrics.headline.participationRate}%`} detail={`${metrics.headline.activeStudents} active students`} tone="orange" />
            </section>
          </>
        )}

        {view === "leads" && <LeadsPanel metrics={metrics} />}

        {view === "people" && (
          <>
            <PeoplePanel metrics={metrics} admin={admin} inviteFlash={inviteFlash} />
            <section className="admin-dashboard-grid two">
              <AdminInvitePanel />
            </section>
          </>
        )}

        {view === "feedback" && (
          <>
            <FeedbackPanel metrics={metrics} />
            <section className="admin-dashboard-grid two">
              <FeedbackSettingsPanel metrics={metrics} />
            </section>
          </>
        )}

        {view === "settings" && (
          <>
            <section className="admin-dashboard-grid two">
              <AdminInvitePanel />
            </section>
            <AuditPanel metrics={metrics} />
          </>
        )}

        {view === "server" && <ServerPanel metrics={serverSnapshot} platform={metrics} aiMetrics={aiUsageSnapshot} />}

        {view === "ai-usage" && <AiUsagePanel metrics={aiUsageSnapshot} />}
      </section>
    </main>
  );
}
