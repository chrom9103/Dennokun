"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchEvents, deleteEvent, createEvent, Event } from "@/lib/eventApi";
import { formatYMD } from "@/lib/formatDate";

export default function Dashboard() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createFormData, setCreateFormData] = useState({ name: "", start_date: "" });
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

  // Filter events based on selected year and search query
  const filteredEvents = events.filter((event) => {
    // Year filter
    if (selectedYear !== null && event.start_date) {
      const eventYear = new Date(event.start_date).getFullYear();
      if (eventYear !== selectedYear) return false;
    }

    // Search filter
    if (searchQuery && !event.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    return true;
  });

  // Get unique years for filter
  const years = Array.from(
    new Set(
      events
        .filter((e) => e.start_date)
        .map((e) => new Date(e.start_date!).getFullYear())
    )
  ).sort((a, b) => b - a);

  async function handleDeleteEvent(eventId: number) {
    if (!confirm("Are you sure you want to delete this event?")) {
      return;
    }

    try {
      await deleteEvent(eventId);
      setEvents(events.filter((e) => e.id !== eventId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete event");
    }
  }

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    
    if (!createFormData.name.trim()) {
      alert("Event name is required");
      return;
    }

    try {
      setCreateLoading(true);
      setError(null);
      const newEvent = await createEvent({
        name: createFormData.name,
        start_date: createFormData.start_date || undefined,
      });
      
      // Add new event to the list
      setEvents([newEvent, ...events]);
      
      // Reset form and close modal
      setCreateFormData({ name: "", start_date: "" });
      setShowCreateModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event");
      console.error(err);
    } finally {
      setCreateLoading(false);
    }
  }

  function handleEventClick(eventId: number) {
    router.push(`/events/${eventId}`);
  }

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600"
        >
          Create Event
        </button>
      </div>

      {error && <div className="mb-4 rounded bg-red-100 p-2 text-red-700">{error}</div>}

      {/* Filters */}
      <div className="mb-6 space-y-4">
        {/* Year Filter */}
        <div>
          <label htmlFor="year-filter" className="mr-2 block font-semibold">
            Year:
          </label>
          <select
            id="year-filter"
            value={selectedYear ?? ""}
            onChange={(e) => setSelectedYear(e.target.value === "" ? null : parseInt(e.target.value))}
            className="rounded border px-2 py-1"
          >
            <option value="">All Years</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div>
          <label htmlFor="search" className="mr-2 block font-semibold">
            Search:
          </label>
          <input
            id="search"
            type="text"
            placeholder="Search by event name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded border px-2 py-1"
          />
        </div>
      </div>

      {/* Events Table */}
      <div className="mb-4">
        {filteredEvents.length === 0 ? (
          <div className="text-gray-500">No events found.</div>
        ) : (
          <table className="w-full border-collapse border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-300 p-2 text-left">Event Name</th>
                <th className="border border-gray-300 p-2 text-left">Start Date</th>
                <th className="border border-gray-300 p-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50">
                  <td className="border border-gray-300 p-2">
                    <button
                      onClick={() => handleEventClick(event.id)}
                      className="text-blue-600 underline hover:text-blue-800"
                    >
                      {event.name}
                    </button>
                  </td>
                  <td className="border border-gray-300 p-2">
                      {event.start_date ? formatYMD(event.start_date) : "-"}
                  </td>
                  <td className="border border-gray-300 p-2 text-center">
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      className="rounded bg-red-500 px-3 py-1 text-white hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-96 rounded bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-xl font-bold">Create New Event</h2>
            
            <form onSubmit={handleCreateEvent}>
              <div className="mb-4">
                <label htmlFor="event-name" className="block font-semibold mb-1">
                  Event Name *
                </label>
                <input
                  id="event-name"
                  type="text"
                  placeholder="Enter event name"
                  value={createFormData.name}
                  onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                  className="w-full rounded border px-2 py-1"
                  disabled={createLoading}
                />
              </div>

              <div className="mb-6">
                <label htmlFor="event-date" className="block font-semibold mb-1">
                  Start Date
                </label>
                <input
                  id="event-date"
                  type="date"
                  value={createFormData.start_date}
                  onChange={(e) => setCreateFormData({ ...createFormData, start_date: e.target.value })}
                  className="w-full rounded border px-2 py-1"
                  disabled={createLoading}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateFormData({ name: "", start_date: "" });
                  }}
                  className="rounded border px-4 py-2 hover:bg-gray-100"
                  disabled={createLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600 disabled:opacity-50"
                  disabled={createLoading}
                >
                  {createLoading ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}