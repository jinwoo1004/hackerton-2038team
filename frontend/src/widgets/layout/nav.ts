import {
  Activity,
  Bell,
  FolderKanban,
  LayoutDashboard,
  Radar,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  soon?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { key: "overview", label: "개요", href: "/overview", icon: LayoutDashboard },
  { key: "projects", label: "프로젝트", href: "/projects", icon: FolderKanban },
  { key: "monitoring", label: "모니터링", href: "/monitoring", icon: Radar },
  { key: "analysis", label: "분석", href: "/analysis", icon: Activity },
  { key: "events", label: "이벤트", href: "/events", icon: Bell },
  { key: "settings", label: "설정", href: "/settings", icon: Settings },
];

export interface ProjectTab {
  key: string;
  label: string;
  segment: string;
  soon?: boolean;
}

export const PROJECT_TABS: ProjectTab[] = [
  { key: "overview", label: "개요", segment: "" },
  { key: "analysis", label: "분석", segment: "/analysis" },
  { key: "logs", label: "로그", segment: "/logs" },
  { key: "agents", label: "에이전트", segment: "/agents" },
  { key: "files", label: "프로젝트 파일", segment: "/files" },
  { key: "settings", label: "설정", segment: "/settings" },
];
