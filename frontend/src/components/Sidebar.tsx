"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import Icon from "./ui/Icon";

/* ──────────────────────────────────────────────
 * Navigation types
 * ────────────────────────────────────────────── */
interface NavItem {
  title: string;
  path: string;
  icon: string;
  children?: NavItem[];
}

/* ──────────────────────────────────────────────
 * Navigation Item Component
 * ────────────────────────────────────────────── */
function SidebarItem({
  item,
  active,
  open,
  onToggle,
  onClose,
}: {
  item: NavItem;
  active: boolean;
  open?: boolean;
  onToggle?: () => void;
  onClose: () => void;
}) {
  const hasChildren = !!item.children;

  if (hasChildren) {
    return (
      <div className="mb-0.5">
        <button
          onClick={onToggle}
          className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm transition-colors hover:bg-black/5 ${
            active ? "text-primary font-medium" : "text-foreground"
          }`}
        >
          <Icon
            name={item.icon}
            size={20}
            className={active ? "text-primary" : "text-muted-foreground"}
          />
          <span className="flex-1 text-left">{item.title}</span>
          <Icon
            name={open ? "expand_less" : "expand_more"}
            size={20}
            className="text-muted-foreground"
          />
        </button>

        {open && (
          <div className="bg-muted/30">
            {item.children?.map((child) => (
              <SidebarItem
                key={child.path}
                item={child}
                active={false} // Logic handled by parent check for depth 1, or can be improved
                onClose={onClose}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Determine if it's a child or top level for padding
  // Simplified for now: just top level and children have different padding
  const isChild = item.path.split("/").length > 4;

  return (
    <Link
      href={item.path}
      onClick={onClose}
      className={`flex items-center gap-3 py-2.5 text-sm transition-colors hover:bg-black/5 ${
        isChild ? "pl-12 pr-5" : "px-5"
      } ${
        active
          ? "text-primary font-medium bg-info-light"
          : "text-muted-foreground"
      }`}
    >
      <Icon
        name={item.icon}
        size={isChild ? 18 : 20}
        className={active ? "text-primary" : "text-muted-foreground"}
      />
      <span>{item.title}</span>
    </Link>
  );
}

/* ──────────────────────────────────────────────
 * Nav Configuration Builder
 * ────────────────────────────────────────────── */
function buildNavItems(eventId?: string): NavItem[] {
  if (!eventId) {
    return [{ title: "ダッシュボード", path: "/dashboard", icon: "dashboard" }];
  }

  return [
    { title: "ダッシュボード", path: "/dashboard", icon: "dashboard" },
    {
      title: "マスタデータ管理",
      path: `/events/${eventId}/master`,
      icon: "settings",
      children: [
        { title: "共通設定", path: `/events/${eventId}/master/common`, icon: "tune" },
        { title: "参加校管理", path: `/events/${eventId}/master/schools`, icon: "school" },
        { title: "チーム管理", path: `/events/${eventId}/master/teams`, icon: "groups" },
        { title: "スタッフ管理", path: `/events/${eventId}/master/staffs`, icon: "admin_panel_settings" },
      ],
    },
    {
      title: "試合管理",
      path: `/events/${eventId}/matches`,
      icon: "sports_score",
      children: [
        { title: "組み合わせ制御", path: `/events/${eventId}/matches/control`, icon: "calendar_month" },
        { title: "進行ボード", path: `/events/${eventId}/matches/board`, icon: "view_list" },
        { title: "スタッフタスク表", path: `/events/${eventId}/matches/staff-tasks`, icon: "event_seat" },
      ],
    },
    {
      title: "集計・結果",
      path: `/events/${eventId}/reports`,
      icon: "assessment",
      children: [
        { title: "順位表", path: `/events/${eventId}/reports/standings`, icon: "bar_chart" },
        { title: "最終結果", path: `/events/${eventId}/reports/final-results`, icon: "emoji_events" },
      ],
    },
  ];
}

/* ──────────────────────────────────────────────
 * Main Sidebar Component
 * ────────────────────────────────────────────── */
export default function Sidebar({
  mobileOpen,
  onMobileClose,
}: {
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const pathname = usePathname();
  const params = useParams();
  const eventId = params?.id as string | undefined;

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    マスタデータ管理: true,
    試合管理: true,
    "集計・結果": true,
  });

  const navItems = buildNavItems(eventId);

  const toggleSection = (title: string) => {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const isActive = (path: string) => pathname === path;
  const isParentActive = (path: string) => pathname.startsWith(path);

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white">
      {/* Brand Header */}
      <Link 
        href="/dashboard"
        className="flex items-center h-16 px-5 bg-primary text-white shrink-0 hover:bg-primary-hover transition-colors"
      >
        <Icon name="smart_toy" size={28} className="mr-3" />
        <span className="text-lg font-medium tracking-wide">大会管理システム</span>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navItems.map((item) => {
          if (item.children) {
            return (
              <SidebarItem
                key={item.title}
                item={item}
                active={isParentActive(item.path)}
                open={openSections[item.title]}
                onToggle={() => toggleSection(item.title)}
                onClose={onMobileClose}
              />
            );
          }
          return (
            <SidebarItem
              key={item.path}
              item={item}
              active={isActive(item.path)}
              onClose={onMobileClose}
            />
          );
        })}
      </nav>

      {/* Version Info */}
      <div className="p-4 border-t border-border text-[10px] text-muted-foreground flex justify-between">
        <span>© 2026 電脳くん Team</span>
        <span>v2.0.0-next</span>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 sm:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[280px] shadow-lg transform transition-transform duration-300 sm:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden sm:flex sm:flex-col sm:fixed sm:inset-y-0 sm:left-0 sm:w-[280px] border-r border-border z-30">
        {sidebarContent}
      </aside>
    </>
  );
}
