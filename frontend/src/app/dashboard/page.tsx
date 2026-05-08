"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchEvents, deleteEvent, createEvent, Event } from "@/lib/eventApi";

import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import EventCard from "@/components/elements/EventCard";
import CreateEventModal from "@/components/elements/CreateEventModal";

export default function Dashboard() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // Load events on mount
  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchEvents();
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Filter events
  const filteredEvents = events.filter((event) => {
    if (selectedYear !== null && event.start_date) {
      const eventYear = new Date(event.start_date).getFullYear();
      if (eventYear !== selectedYear) return false;
    }
    if (
      searchQuery &&
      !event.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  // Get unique years
  const years = Array.from(
    new Set(
      events
        .filter((e) => e.start_date)
        .map((e) => new Date(e.start_date!).getFullYear())
    )
  ).sort((a, b) => b - a);

  const handleDeleteEvent = async (eventId: number) => {
    if (!confirm("この大会を削除してもよろしいですか？")) {
      return;
    }
    try {
      await deleteEvent(eventId);
      setEvents(events.filter((e) => e.id !== eventId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete event");
    }
  };

  const handleCreateEvent = async (data: { name: string; start_date: string }) => {
    try {
      setCreateLoading(true);
      const newEvent = await createEvent({
        name: data.name,
        start_date: data.start_date || undefined,
      });
      setEvents([newEvent, ...events]);
      setShowCreateModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setCreateLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
        </div>
        <p className="text-muted-foreground animate-pulse">データを読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">大会一覧</h1>
          <p className="text-muted-foreground mt-1">運営中の大会や過去のアーカイブを確認できます。</p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          icon="add"
          size="lg"
          className="h-12"
        >
          新規大会作成
        </Button>
      </div>

      {/* Stats Bar (Example of a new componentized section) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-info-light flex items-center justify-center text-primary">
            <Icon name="event" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase">全大会数</p>
            <p className="text-2xl font-bold">{events.length}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-success-light flex items-center justify-center text-success">
            <Icon name="play_circle" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase">進行中</p>
            <p className="text-2xl font-bold">
              {events.filter(e => {
                if (!e.start_date) return false;
                const d = new Date(e.start_date);
                const now = new Date();
                return Math.abs(d.getTime() - now.getTime()) < 1000 * 60 * 60 * 24 * 2;
              }).length}
            </p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-warning-light flex items-center justify-center text-yellow-700">
            <Icon name="history" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase">完了</p>
            <p className="text-2xl font-bold">
              {events.filter(e => e.start_date && new Date(e.start_date) < new Date()).length}
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-end md:items-center bg-white p-4 rounded-xl border border-border shadow-sm">
        <div className="flex-1 w-full">
          <Input
            placeholder="大会名で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11"
            id="search-events"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <select
            value={selectedYear ?? ""}
            onChange={(e) =>
              setSelectedYear(e.target.value === "" ? null : parseInt(e.target.value))
            }
            className="flex-1 md:w-40 h-11 px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          >
            <option value="">全年度</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}年
              </option>
            ))}
          </select>
          <Button variant="secondary" className="h-11" onClick={loadEvents} icon="refresh">
            <span className="hidden sm:inline">更新</span>
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-3 px-6 py-4 rounded-xl bg-red-50 border border-red-200 text-red-700">
          <Icon name="error_outline" size={24} />
          <div>
            <p className="font-bold">エラーが発生しました</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Event Grid */}
      {filteredEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-dashed border-border text-muted-foreground">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
            <Icon name="event_busy" size={40} className="opacity-20" />
          </div>
          <p className="text-lg font-medium">大会が見つかりません</p>
          <p className="text-sm">条件を変えて検索するか、新しい大会を作成してください。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onClick={(id) => router.push(`/events/${id}/master/common`)}
              onDelete={handleDeleteEvent}
            />
          ))}
        </div>
      )}

      {/* Create Event Modal */}
      <CreateEventModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateEvent}
        isLoading={createLoading}
      />
    </div>
  );
}