import Link from "next/link";
import {
  BookOpen,
  FileQuestion,
  GraduationCap,
  LogOut,
  Archive,
  ChevronDown,
  UserRound,
  UsersRound
} from "lucide-react";
import { logoutTeacher } from "@/app/teacher/actions";
import { logoutStudent } from "@/app/student/actions";
import { ThemeToggle } from "@/components/ThemeToggle";

export function PublicTopbar() {
  return (
    <header className="topbar public-topbar">
      <Link className="brand" href="/">
        <img className="brand-logo" src="/images/charlotte-ai-logo.png" alt="" />
        <span>Charlotte AI</span>
      </Link>
      <nav className="marketing-nav" aria-label="Marketing navigation">
        <a href="#features" data-no-loading="true">Features</a>
        <a href="#benefits" data-no-loading="true">Benefits</a>
        <a href="#contact" data-no-loading="true">Contact</a>
      </nav>
      <nav className="nav-links">
        <Link className="ghost-button" href="/teacher/login">
          <GraduationCap size={18} />
          Teacher
        </Link>
        <Link className="ghost-button" href="/student/login">
          <BookOpen size={18} />
          Student
        </Link>
      </nav>
    </header>
  );
}

export function TeacherTopbar({ name, classroomId }: { name: string; classroomId?: string }) {
  const assignmentsHref = classroomId
    ? `/teacher/classes/${classroomId}/materials`
    : "/teacher/assignments";

  return (
    <header className="topbar teacher-topbar" data-tour="teacher-sidebar">
      <Link className="brand" href="/teacher/classes">
        <img className="brand-logo" src="/images/charlotte-ai-logo.png" alt="" />
        <span>Charlotte AI</span>
      </Link>
      <nav className="teacher-topbar-nav" aria-label="Teacher navigation">
        <Link href="/teacher/classes"><UsersRound size={17} /> Classes</Link>
        <Link href={assignmentsHref}><FileQuestion size={17} /> Assignments</Link>
      </nav>
      <details className="teacher-account-menu teacher-topbar-account">
        <summary>
          <span className="teacher-user"><strong>{name}</strong></span>
          <ChevronDown size={17} />
        </summary>
        <div className="teacher-account-panel">
          <ThemeToggle />
          <Link href="/teacher/account"><UserRound size={17} /> Account</Link>
          <Link href="/teacher/archive"><Archive size={17} /> Archive</Link>
          <form action={logoutTeacher}>
            <button type="submit"><LogOut size={17} /> Sign out</button>
          </form>
        </div>
      </details>
    </header>
  );
}

export function StudentTopbar({ name }: { name: string }) {
  return (
    <header className="topbar">
      <Link className="brand" href="/student">
        <img className="brand-logo" src="/images/charlotte-ai-logo.png" alt="" />
        <span>Charlotte AI</span>
      </Link>
      <nav className="nav-links">
        <span className="muted">{name}</span>
        <Link className="ghost-button" href="/student/classes">
          <GraduationCap size={18} />
          My classes
        </Link>
        <form action={logoutStudent}>
          <button className="ghost-button" type="submit">
            <LogOut size={18} />
            Sign out
          </button>
        </form>
      </nav>
    </header>
  );
}
