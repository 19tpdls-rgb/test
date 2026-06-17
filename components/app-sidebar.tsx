import Link from "next/link";
import {
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  MessageSquareText,
  ReceiptText,
} from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const navigationItems = [
  {
    href: "/dashboard",
    label: "대시보드",
    icon: LayoutDashboard,
  },
  {
    href: "/reservations",
    label: "예약 관리",
    icon: ClipboardList,
  },
  {
    href: "/refunds",
    label: "환불 관리",
    icon: CreditCard,
  },
  {
    href: "/sms-templates",
    label: "문자 템플릿",
    icon: MessageSquareText,
  },
  {
    href: "/sms-logs",
    label: "문자 로그",
    icon: ReceiptText,
  },
];

type AppSidebarProps = {
  adminName?: string | null;
};

export function AppSidebar({ adminName }: AppSidebarProps) {
  return (
    <aside className="border-b bg-card md:min-h-screen md:w-64 md:border-b-0 md:border-r">
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-1">
          <Link href="/dashboard" className="font-heading text-base font-medium">
            PICUP PICNIC
          </Link>
          <p className="text-sm text-muted-foreground">
            {adminName ?? "Admin"}
          </p>
        </div>
        <Separator />
        <nav
          className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible"
          aria-label="관리자 메뉴"
        >
          {navigationItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  "[&_svg]:size-4 [&_svg]:shrink-0",
                )}
              >
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
