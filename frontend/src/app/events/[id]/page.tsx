"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getEventById, Event } from "@/lib/eventApi";
import { formatYMD } from "@/lib/formatDate";

function Icon({
  name,
  className = "",
  size = 20,
}: {
  name: string;
  className?: string;
  size?: number;
}) {
  return (
    <span className={`material-icons-outlined ${className}`} style={{ fontSize: size }}>
      {name}
    </span>
  );
}

export default function EventDetail() {
  const router = useRouter();
  const params = useParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) {
      setError("Event ID not found");
      setLoading(false);
      return;
    }
    loadEvent();
  }, [params?.id]);

  async function loadEvent() {
    try {
      setLoading(true);
      setError(null);
      const eventIdStr = Array.isArray(params?.id) ? params?.id[0] : params?.id;
      const eventId = parseInt(eventIdStr as string);

      if (isNaN(eventId)) {
        throw new Error("Invalid event ID");
      }

      const data = await getEventById(eventId);
      setEvent(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load event");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

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
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
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

  return (
    <div>
      <button
        onClick={() => router.push("/dashboard")}
        className="flex items-center gap-1 text-sm text-primary hover:underline mb-4"
      >
        <Icon name="arrow_back" size={16} />
        ダッシュボードに戻る
      </button>

      <h1 className="mb-6">{event.name}</h1>

      <div className="bg-white rounded-lg shadow-[var(--shadow-sm)] p-6">
        <h3 className="mb-4">大会情報</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">大会ID</p>
            <p className="text-sm">{event.id}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">開催日</p>
            <p className="text-sm">{event.start_date ? formatYMD(event.start_date) : "-"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">スプレッドシートID</p>
            <p className="text-sm">{event.spreadsheet_id || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">バケット名</p>
            <p className="text-sm">{event.bucket_name || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">速報URL</p>
            <p className="text-sm">{event.flash_news_url || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">作成日</p>
            <p className="text-sm">{new Date(event.created_at).toLocaleDateString("ja-JP")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
