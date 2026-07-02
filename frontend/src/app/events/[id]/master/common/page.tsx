"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import DivisionSettings from "@/components/pages/events/master/common/DivisionSettings";
import RoomSettings from "@/components/pages/events/master/common/RoomSettings";
import TimeSlotSettings from "@/components/pages/events/master/common/TimeSlotSettings";
import { Card } from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";

const tabs = [
  { id: "division", label: "部門設定" },
  { id: "room", label: "会場設定" },
  { id: "timeslot", label: "時間枠設定" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function CommonPage() {
  const params = useParams();
  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const eventId = rawId ? parseInt(rawId as string) : null;

  const [activeTab, setActiveTab] = useState<TabId>("division");

  if (!eventId || isNaN(eventId)) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>大会IDが無効です</p>
      </div>
    );
  }

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
              <DivisionSettings eventId={eventId} />
            )}
            {activeTab === "room" && (
              <RoomSettings eventId={eventId} />
            )}
            {activeTab === "timeslot" && (
              <TimeSlotSettings eventId={eventId} />
            )}
          </div>
        </div>
      </Card>
      
      <div className="bg-info-light/20 p-4 rounded-lg border border-info-light flex gap-3">
        <div className="text-info shrink-0">
          <Icon name="help_outline" size={20} />
        </div>
        <p className="text-xs text-info-dark leading-relaxed">
          これらの設定はマッチング生成に直接影響します。大会開始後の変更は慎重に行ってください。
          特に時間枠の変更は、既に生成された試合スケジュールに不整合が生じる可能性があります。
        </p>
      </div>
    </div>
  );
}
