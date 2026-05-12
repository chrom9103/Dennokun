"use client";

import { useState } from "react";
import DivisionSettings from "@/components/pages/events/master/common/DivisionSettings";
import RoomSettings from "@/components/pages/events/master/common/RoomSettings";
import TimeSlotSettings from "@/components/pages/events/master/common/TimeSlotSettings";
import { Card } from "@/components/ui/Card";

const tabs = [
  { id: "division", label: "部門設定" },
  { id: "room", label: "会場設定" },
  { id: "timeslot", label: "時間枠設定" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function CommonPage() {
  const [activeTab, setActiveTab] = useState<TabId>("division");

  // Mock data - in a real app, these might be fetched via a hook or props
  const [divisions] = useState<{ id: string; name: string; code: string }[]>([]);
  const [rooms] = useState<{ id: string; name: string; capacity: number }[]>([]);
  const [timeSlots] = useState<{ id: string; name: string; startTime: string; endTime: string }[]>([]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">共通設定</h1>
          <p className="text-sm text-muted-foreground mt-1">
            大会の基本となる部門、会場、時間枠の定義を行います。
          </p>
        </div>
      </div>

      <Card>
        {/* Tab Navigation */}
        <div className="border-b border-border bg-muted/10">
          <nav className="flex px-2" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative px-6 py-4 text-sm font-medium transition-all
                  ${
                    activeTab === tab.id
                      ? "text-primary border-b-2 border-primary bg-white shadow-[0_1px_0_0_#fff]"
                      : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6 min-h-[400px]">
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {activeTab === "division" && (
              <DivisionSettings divisions={divisions} />
            )}
            {activeTab === "room" && (
              <RoomSettings rooms={rooms} />
            )}
            {activeTab === "timeslot" && (
              <TimeSlotSettings timeSlots={timeSlots} />
            )}
          </div>
        </div>
      </Card>
      
      <div className="bg-info-light/20 p-4 rounded-lg border border-info-light flex gap-3">
        <div className="text-info shrink-0">
          <span className="material-icons-outlined">help_outline</span>
        </div>
        <p className="text-xs text-info-dark leading-relaxed">
          これらの設定はマッチング生成に直接影響します。大会開始後の変更は慎重に行ってください。
          特に時間枠の変更は、既に生成された試合スケジュールに不整合が生じる可能性があります。
        </p>
      </div>
    </div>
  );
}
