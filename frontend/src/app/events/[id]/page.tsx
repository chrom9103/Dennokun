"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getEventById, Event } from "@/lib/eventApi";
import { formatYMD } from "@/lib/formatDate";
import { fetchDashboardSummary, DashboardSummary } from "@/lib/generateApi";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";

interface QuickLink {
  label: string;
  desc: string;
  icon: string;
  path: string;
  color: string;
}

export default function EventDetail() {
  const router = useRouter();
  const params = useParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) {
      setError("Event ID not found");
      setLoading(false);
      return;
    }
    loadAll();
  }, [params?.id]);

  async function loadAll() {
    try {
      setLoading(true);
      setError(null);
      const eventIdStr = Array.isArray(params?.id) ? params?.id[0] : params?.id;
      const eventId = parseInt(eventIdStr as string);
      if (isNaN(eventId)) throw new Error("Invalid event ID");
      const [eventData, summaryData] = await Promise.all([
        getEventById(eventId),
        fetchDashboardSummary(eventId).catch(() => null),
      ]);
      setEvent(eventData);
      setSummary(summaryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load event");
    } finally {
      setLoading(false);
    }
  }

  const eventIdNum = event?.id;

  const quickLinks: QuickLink[] = eventIdNum ? [
    { label: "組み合わせ制御", desc: "試合の自動生成・微調整", icon: "auto_awesome", path: `/events/${eventIdNum}/matches/control`, color: "bg-blue-50 border-blue-200 text-blue-700" },
    { label: "進行ボード", desc: "全試合の進行状況を確認", icon: "view_list", path: `/events/${eventIdNum}/matches/board`, color: "bg-purple-50 border-purple-200 text-purple-700" },
    { label: "チーム管理", desc: "チーム・グループの登録", icon: "groups", path: `/events/${eventIdNum}/master/teams`, color: "bg-green-50 border-green-200 text-green-700" },
    { label: "スタッフ管理", desc: "ジャッジの役割・利害関係設定", icon: "badge", path: `/events/${eventIdNum}/master/staffs`, color: "bg-amber-50 border-amber-200 text-amber-700" },
    { label: "順位表", desc: "現在の予選順位をリアルタイム確認", icon: "leaderboard", path: `/events/${eventIdNum}/reports/standings`, color: "bg-teal-50 border-teal-200 text-teal-700" },
    { label: "最終結果", desc: "大会の最終的な表彰結果", icon: "emoji_events", path: `/events/${eventIdNum}/reports/final-results`, color: "bg-orange-50 border-orange-200 text-orange-700" },
    { label: "基本情報管理", desc: "部門・会場・時間枠・参加校", icon: "settings", path: `/events/${eventIdNum}/master/common`, color: "bg-gray-50 border-gray-200 text-gray-700" },
  ] : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-muted-foreground">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>読み込み中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <Icon name="error_outline" size={18} />
          <p>{error}</p>
        </div>
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-primary hover:underline">
          <Icon name="arrow_back" size={16} />
          戻る
        </button>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Icon name="event_busy" size={48} className="mb-3 opacity-50" />
        <p>大会が見つかりません</p>
      </div>
    );
  }

  const completionRate = summary && summary.total_matches > 0
    ? Math.round((summary.confirmed_matches / summary.total_matches) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <button onClick={() => router.push("/dashboard")} className="flex items-center gap-1 text-sm text-primary hover:underline">
        <Icon name="arrow_back" size={16} />
        ダッシュボードに戻る
      </button>

      {/* Event hero */}
      <div className="bg-gradient-to-br from-primary/90 to-primary rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-white/70 text-sm mb-1">大会</p>
            <h1 className="text-3xl font-bold">{event.name}</h1>
            <p className="text-white/70 text-sm mt-2">
              {event.start_date ? formatYMD(event.start_date) : "日時未設定"} · ID: {event.id}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => router.push(`/events/${event.id}/matches/control`)}
              className="bg-white/20 hover:bg-white/30 text-white border-white/20"
            >
              <Icon name="auto_awesome" size={18} />
              <span className="ml-2">試合生成</span>
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        {summary && summary.total_matches > 0 && (
          <div className="mt-6">
            <div className="flex justify-between text-sm text-white/80 mb-2">
              <span>試合進捗</span>
              <span>{summary.confirmed_matches} / {summary.total_matches} 試合確定 ({completionRate}%)</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "チーム数", value: summary.total_teams, icon: "groups", color: "text-blue-600 bg-blue-50" },
            { label: "スタッフ数", value: summary.total_staffs, icon: "badge", color: "text-purple-600 bg-purple-50" },
            { label: "総試合数", value: summary.total_matches, icon: "sports", color: "text-teal-600 bg-teal-50" },
            { label: "入力待ち", value: summary.pending_matches, icon: "pending_actions", color: "text-amber-600 bg-amber-50" },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="bg-white rounded-xl border border-border p-4 flex items-center gap-3 shadow-sm">
              <div className={`p-2 rounded-lg ${color.split(" ")[1]}`}>
                <Icon name={icon} size={22} className={color.split(" ")[0]} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick links */}
      <div>
        <h2 className="text-lg font-semibold mb-3">機能一覧</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickLinks.map((link) => (
            <button
              key={link.path}
              onClick={() => router.push(link.path)}
              className={`flex items-center gap-3 p-4 rounded-xl border text-left hover:shadow-md transition-all hover:-translate-y-0.5 ${link.color}`}
            >
              <Icon name={link.icon} size={28} />
              <div>
                <p className="font-semibold">{link.label}</p>
                <p className="text-xs opacity-70">{link.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Event info */}
      <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
        <h3 className="font-semibold mb-4 text-sm text-muted-foreground uppercase tracking-wide">大会詳細情報</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            ["大会ID", String(event.id)],
            ["開催日", event.start_date ? formatYMD(event.start_date) : "-"],
            ["スプレッドシートID", event.spreadsheet_id || "-"],
            ["バケット名", event.bucket_name || "-"],
            ["速報URL", event.flash_news_url || "-"],
            ["作成日", new Date(event.created_at).toLocaleDateString("ja-JP")],
          ].map(([l, v]) => (
            <div key={l}>
              <p className="text-xs text-muted-foreground mb-1">{l}</p>
              <p className="text-sm font-medium break-all">{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
