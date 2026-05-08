"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";

/* ──────────────────────────────────────────────
 * User Menu Component
 * ────────────────────────────────────────────── */
function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium hover:opacity-90 transition-opacity"
      >
        管
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-border z-50 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="px-4 py-2.5 border-b border-border">
              <p className="text-xs text-muted-foreground mb-0.5">管理者としてログイン中</p>
              <p className="text-sm font-medium truncate">admin@example.com</p>
            </div>
            <div className="py-1">
              <button className="w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2">
                <Icon name="person" size={18} className="text-muted-foreground" />
                プロフィール
              </button>
              <button className="w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2">
                <Icon name="settings" size={18} className="text-muted-foreground" />
                アカウント設定
              </button>
            </div>
            <div className="border-t border-border py-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  window.location.href = "/login";
                }}
                className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-red-50 transition-colors flex items-center gap-2"
              >
                <Icon name="logout" size={18} className="text-destructive" />
                ログアウト
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────
 * AppShell Layout Component
 * ────────────────────────────────────────────── */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-secondary">
      {/* Navigation Sidebar */}
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 sm:ml-[280px] min-w-0">
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-20 flex items-center h-16 px-4 sm:px-6 bg-white border-b border-border shadow-sm">
          {/* Mobile Menu Trigger */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileOpen(true)}
            className="sm:hidden mr-3 p-2 rounded-full"
            aria-label="メニューを開く"
          >
            <Icon name="menu" size={24} />
          </Button>

          {/* Breadcrumbs or Title could go here */}
          <div className="flex-1" />

          {/* Notification / Search / User Menu */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="p-2 rounded-full text-muted-foreground">
              <Icon name="notifications" size={20} />
            </Button>
            <UserMenu />
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
