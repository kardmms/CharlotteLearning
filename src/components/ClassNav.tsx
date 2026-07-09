import Link from "next/link";
import {
  FileQuestion,
  House,
  LayoutDashboard,
  TableProperties,
  UsersRound
} from "lucide-react";

const navItems = [
  { href: "", label: "Overview", icon: LayoutDashboard },
  { href: "/roster", label: "Students", icon: UsersRound },
  { href: "/progress", label: "Progress", icon: TableProperties },
  { href: "/materials", label: "Assignments", icon: FileQuestion },
  { href: "/home-learning", label: "At-home", icon: House }
];

export function ClassNav({ classroomId }: { classroomId: string }) {
  return (
    <nav className="dashboard-nav" aria-label="Class dashboard sections">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link className="dashboard-nav-item" href={`/teacher/classes/${classroomId}${item.href}`} key={item.label}>
            <Icon size={18} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
