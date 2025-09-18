import { ReactNode } from "react";
import { Eye, MessageCircleCode, Home, ArrowLeft } from "lucide-react";
import Link from "next/link";

import { HanzoLogo } from "@/components/HanzoLogo";

import { Button } from "@/components/ui/button";
import classNames from "classnames";

const TABS = [
  {
    value: "chat",
    label: "Chat",
    icon: MessageCircleCode,
  },
  {
    value: "preview",
    label: "Preview",
    icon: Eye,
  },
];

export function Header({
  tab,
  onNewTab,
  children,
}: {
  tab: string;
  onNewTab: (tab: string) => void;
  children?: ReactNode;
}) {
  return (
    <header className="border-b bg-slate-200 border-slate-300 dark:bg-neutral-950 dark:border-neutral-800 px-3 lg:px-6 py-2 flex items-center max-lg:gap-3 justify-between lg:grid lg:grid-cols-3 z-20">
      <div className="flex items-center justify-start gap-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">H</span>
          </div>
          <span className="hidden md:inline font-semibold">Hanzo Dev</span>
        </Link>
        <div className="h-6 w-px bg-neutral-700 hidden md:block" />
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="gap-2">
            <Home className="size-4" />
            <span className="hidden md:inline">Dashboard</span>
          </Button>
        </Link>
        <Link href="/chat">
          <Button variant="ghost" size="sm" className="gap-2">
            <MessageCircleCode className="size-4" />
            <span className="hidden md:inline">Chat</span>
          </Button>
        </Link>
      </div>
      <div className="flex items-center justify-start lg:justify-center gap-1 max-lg:pl-3 flex-1 max-lg:border-l max-lg:border-l-neutral-800">
        {TABS.map((item) => (
          <Button
            key={item.value}
            variant={tab === item.value ? "secondary" : "ghost"}
            className={classNames("", {
              "opacity-60": tab !== item.value,
            })}
            size="sm"
            onClick={() => onNewTab(item.value)}
          >
            <item.icon className="size-4" />
            <span className="hidden md:inline">{item.label}</span>
          </Button>
        ))}
      </div>
      <div className="flex items-center justify-end gap-3">{children}</div>
    </header>
  );
}
