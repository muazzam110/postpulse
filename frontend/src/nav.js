import { BookMarked, CalendarDays, ChartColumn, Library, Mic, PenLine, Settings, CalendarRange } from "lucide-react";

export const NAV = [
  { to: "studio", label: "Studio", icon: PenLine, blurb: "Turn a source into a draft." },
  { to: "library", label: "Library", icon: Library, blurb: "Every draft, approved post and rejection in one place." },
  { to: "knowledge", label: "Knowledge", icon: BookMarked, blurb: "The notes and posts Copilot draws on." },
  { to: "planner", label: "Planner", icon: CalendarRange, blurb: "Plan your week of posts." },
  { to: "calendar", label: "Calendar", icon: CalendarDays, blurb: "See what is scheduled and when." },
  { to: "analytics", label: "Analytics", icon: ChartColumn, blurb: "Track how your posts perform." },
];

export const FOOTER_NAV = [
  { to: "voice", label: "Brand voice", icon: Mic, blurb: "Teach Copilot how you write." },
  { to: "settings", label: "Settings", icon: Settings, blurb: "Account, timezone and your OpenRouter key." },
];

export const ALL_NAV = [...NAV, ...FOOTER_NAV];
export const MOBILE_TABS = ["studio", "library", "planner", "calendar"];
