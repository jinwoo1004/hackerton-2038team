import {
  Activity,
  BarChart3,
  Bell,
  ChevronDown,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import { APP } from "@/shared/config/app";
import { cn } from "@/shared/lib/cn";
import { LogoMark } from "@/shared/ui/Logo";

const MENU = [
  { icon: LayoutDashboard, label: "대시보드", active: true },
  { icon: FolderKanban, label: "프로젝트" },
  { icon: BarChart3, label: "분석" },
  { icon: FileText, label: "로그" },
  { icon: Activity, label: "모니터링" },
  { icon: Bell, label: "이벤트" },
  { icon: Settings, label: "설정" },
];

const EVENTS = [
  { time: "09:48:21", project: "TREECS", server: "api-server", event: "응답 지연 (300ms)", level: "위험" },
  { time: "09:47:10", project: "MONITOR", server: "db-server", event: "연결 불량 감지", level: "주의" },
  { time: "09:45:31", project: "PORTAL", server: "web-server", event: "CPU 사용량 비정상", level: "주의" },
];

const TREND = [8, 10, 9, 13, 11, 16, 14, 19, 15, 22, 18, 26, 21, 24, 30, 23, 27, 33, 26, 29, 35, 28, 31, 24];

function trendPath() {
  const w = 300;
  const h = 96;
  const max = 40;
  const pts = TREND.map((v, i) => [(i / (TREND.length - 1)) * w, h - (v / max) * h] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return { line, area: `${line} L${w},${h} L0,${h} Z` };
}

export function DashboardPreview({ userName }: { userName?: string }) {
  const name = userName || "김개발";
  const { line, area } = trendPath();

  return (
    <div className="relative select-none" aria-hidden>
      <div
        className="absolute -right-2 -top-6 h-16 w-40 opacity-60"
        style={{ backgroundImage: "radial-gradient(#93C5FD 1.2px, transparent 1.2px)", backgroundSize: "12px 12px" }}
      />

      <div className="[perspective:2200px]">
        <div className="origin-left overflow-hidden rounded-[22px] bg-white shadow-[0_50px_100px_-40px_rgba(30,64,175,0.45),0_0_0_1px_rgba(15,23,42,0.05)] [transform:rotateY(-11deg)_rotateX(3deg)]">
          <div className="grid grid-cols-[132px_1fr]">
            <aside className="border-r border-toss-line2 px-3 py-4">
              <div className="flex items-center gap-1.5 px-1.5">
                <LogoMark size={22} />
                <span className="text-[13px] font-extrabold tracking-tight text-toss-ink">{APP.shortName}</span>
              </div>
              <ul className="mt-5 space-y-1">
                {MENU.map((m) => (
                  <li
                    key={m.label}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2 py-2 text-[11px] font-semibold",
                      m.active ? "bg-primary-50 text-primary-700" : "text-toss-mid",
                    )}
                  >
                    <m.icon size={13} strokeWidth={2} />
                    {m.label}
                  </li>
                ))}
              </ul>
            </aside>

            <div className="min-w-0 bg-[#FAFBFD] px-4 pb-4 pt-3">
              <div className="flex items-center gap-3">
                <div className="flex h-7 flex-1 items-center gap-1.5 rounded-lg bg-white px-2.5 text-[10px] text-toss-sub ring-1 ring-toss-line2">
                  <Search size={11} />
                  프로젝트, 서버, 이벤트를 검색하세요.
                </div>
                <Bell size={13} className="text-toss-mid" />
                <div className="flex items-center gap-1.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-[10px] font-bold text-white">
                    {name.slice(0, 1)}
                  </span>
                  <span className="leading-tight">
                    <span className="block text-[10px] font-bold text-toss-ink">{name}님</span>
                    <span className="block text-[9px] text-toss-sub">개발팀</span>
                  </span>
                </div>
              </div>

              <p className="mt-4 text-[14px] font-extrabold text-toss-ink">전체 현황</p>

              <div className="mt-2.5 grid grid-cols-4 gap-2">
                <Stat label="전체 프로젝트" value="128" chip="+12%" />
                <Stat label="정상" value="116" dot="bg-toss-green" />
                <Stat label="주의" value="9" dot="bg-[#F59E0B]" />
                <Stat label="위험" value="3" dot="bg-toss-red" />
              </div>

              <div className="mt-2 grid grid-cols-[1fr_1.35fr] gap-2">
                <Panel title="프로젝트 상태">
                  <div className="flex items-center gap-3">
                    <Donut />
                    <ul className="space-y-1.5 text-[9.5px]">
                      <Legend color="bg-toss-green" label="정상" value="116" />
                      <Legend color="bg-[#F59E0B]" label="주의" value="9" />
                      <Legend color="bg-toss-red" label="위험" value="3" />
                    </ul>
                  </div>
                </Panel>
                <Panel
                  title="이상 이벤트 추이"
                  extra={
                    <span className="flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] text-toss-mid ring-1 ring-toss-line2">
                      최근 24시간 <ChevronDown size={9} />
                    </span>
                  }
                >
                  <svg viewBox="0 0 300 110" className="h-[92px] w-full" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#3B82F6" stopOpacity="0.28" />
                        <stop offset="1" stopColor="#3B82F6" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {[0, 24, 48, 72, 96].map((y) => (
                      <line key={y} x1="0" x2="300" y1={y} y2={y} stroke="#EEF1F5" strokeWidth="1" />
                    ))}
                    <path d={area} fill="url(#trendFill)" />
                    <path d={line} fill="none" stroke="#2563EB" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                  <div className="mt-1 flex justify-between text-[8.5px] tabular-nums text-toss-sub">
                    <span>00:00</span>
                    <span>06:00</span>
                    <span>12:00</span>
                    <span>18:00</span>
                    <span>24:00</span>
                  </div>
                </Panel>
              </div>

              <Panel title="최근 이벤트" className="mt-2">
                <table className="w-full text-left text-[9.5px]">
                  <thead className="text-toss-sub">
                    <tr>
                      {["시간", "프로젝트", "서버", "이벤트", "상태"].map((h) => (
                        <th key={h} className="pb-1.5 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-toss-ink">
                    {EVENTS.map((e) => (
                      <tr key={e.time} className="border-t border-toss-line2">
                        <td className="py-1.5 tabular-nums text-toss-mid">{e.time}</td>
                        <td className="py-1.5 font-semibold">{e.project}</td>
                        <td className="py-1.5 text-toss-mid">{e.server}</td>
                        <td className="py-1.5">{e.event}</td>
                        <td className={cn("py-1.5 font-bold", e.level === "위험" ? "text-toss-red" : "text-[#E08A00]")}>
                          {e.level}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-10 right-2 animate-breathe [animation-duration:4s]">
        <div className="flex items-center gap-3.5 rounded-2xl bg-white px-5 py-4 shadow-[0_24px_50px_-18px_rgba(30,64,175,0.35)] ring-1 ring-toss-line2">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-50 text-primary-600">
            <Sparkles size={20} strokeWidth={2} />
          </span>
          <span>
            <span className="block text-[15px] font-extrabold text-toss-ink">AI 분석이 준비되었습니다</span>
            <span className="mt-0.5 block text-[12.5px] text-toss-sub">프로젝트 등록 후 더 정확한 분석을 제공해요.</span>
          </span>
        </div>
      </div>

      <div className="absolute -bottom-24 -left-6 flex items-end gap-1 text-primary-400">
        <p className="-rotate-[8deg] font-hand text-[26px] leading-[1.05]">
          프로젝트의
          <br />
          모든 것을 한 곳에서
        </p>
        <svg width="54" height="46" viewBox="0 0 54 46" fill="none" className="mb-16 -ml-3">
          <path d="M4 42C14 26 28 14 46 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M38 5l9 3-4 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

function Stat({ label, value, chip, dot }: { label: string; value: string; chip?: string; dot?: string }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-toss-line2">
      <p className="flex items-center gap-1 text-[9.5px] font-semibold text-toss-sub">{label}</p>
      <p className="mt-1 flex items-center gap-1.5">
        {dot && <span className={cn("h-2 w-2 rounded-full", dot)} />}
        <span className="text-[18px] font-extrabold leading-none tracking-tight text-toss-ink">{value}</span>
        {chip && (
          <span className="rounded bg-toss-green-soft px-1 py-0.5 text-[8.5px] font-bold text-toss-green">{chip}</span>
        )}
      </p>
    </div>
  );
}

function Panel({
  title,
  extra,
  className,
  children,
}: {
  title: string;
  extra?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl bg-white px-3 py-2.5 ring-1 ring-toss-line2", className)}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10.5px] font-bold text-toss-ink">{title}</p>
        {extra}
      </div>
      {children}
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className={cn("h-1.5 w-1.5 rounded-full", color)} />
      <span className="w-7 text-toss-mid">{label}</span>
      <span className="font-bold tabular-nums text-toss-ink">{value}</span>
    </li>
  );
}

function Donut() {
  const r = 34;
  const c = 2 * Math.PI * r;
  const parts = [
    { v: 116, color: "#2563EB" },
    { v: 9, color: "#F59E0B" },
    { v: 3, color: "#E5484D" },
  ];
  const total = parts.reduce((s, p) => s + p.v, 0);
  let offset = 0;
  return (
    <div className="relative h-[88px] w-[88px] shrink-0">
      <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#EEF1F5" strokeWidth="11" />
        {parts.map((p) => {
          const len = (p.v / total) * c;
          const el = (
            <circle
              key={p.color}
              cx="44"
              cy="44"
              r={r}
              fill="none"
              stroke={p.color}
              strokeWidth="11"
              strokeDasharray={`${Math.max(len - 1.5, 0.5)} ${c}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[15px] font-extrabold text-toss-ink">128</span>
        <span className="mt-1 text-[8.5px] text-toss-sub">전체</span>
      </span>
    </div>
  );
}
