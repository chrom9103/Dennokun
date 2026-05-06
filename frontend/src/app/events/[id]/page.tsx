"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getEventById, Event } from "@/lib/eventApi";
import { formatYMD } from "@/lib/formatDate";

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
    return <div className="p-4">Loading...</div>;
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="mb-4 rounded bg-red-100 p-2 text-red-700">{error}</div>
        <button onClick={() => router.back()} className="text-blue-600 underline">
          Back
        </button>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-4">
        <div className="mb-4">Event not found.</div>
        <button onClick={() => router.back()} className="text-blue-600 underline">
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <button onClick={() => router.back()} className="mb-4 text-blue-600 underline">
        &larr; Back to Dashboard
      </button>

      <h1 className="mb-4 text-2xl font-bold">{event.name}</h1>

      <div className="space-y-2">
        <div>
          <strong>Event ID:</strong> {event.id}
        </div>
        <div>
          <strong>Start Date:</strong> {event.start_date ? formatYMD(event.start_date) : "-"}
        </div>
        <div>
          <strong>Spreadsheet ID:</strong> {event.spreadsheet_id || "-"}
        </div>
        <div>
          <strong>Bucket Name:</strong> {event.bucket_name || "-"}
        </div>
        <div>
          <strong>Flash News URL:</strong> {event.flash_news_url || "-"}
        </div>
        <div>
          <strong>Created:</strong> {new Date(event.created_at).toLocaleDateString("en-US")}
        </div>
      </div>

      <div className="mt-6">
        <p className="text-gray-500">This is a placeholder event detail page. Future sections will be added here.</p>
      </div>
    </div>
  );
}
