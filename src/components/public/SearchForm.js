"use client";

import { useState } from "react";

export default function SearchForm({
  events = [],
  defaultEventId = "",
  defaultValue = "",
  compact = false,
}) {
  const validDefaultEventId = events.some((event) => event.id === defaultEventId)
    ? defaultEventId
    : "";
  const [selectedEventId, setSelectedEventId] = useState(validDefaultEventId);
  const [query, setQuery] = useState(defaultValue);

  const inputId = compact ? "search-query-page" : "search-query-home";
  const eventInputId = compact ? "search-event-page" : "search-event-home";

  return (
    <form
      action="/search"
      method="get"
      className="space-y-4"
    >
      <label className="block text-sm font-semibold text-slate-700" htmlFor={eventInputId}>
        เลือกกิจกรรมก่อนค้นหา
        <select
          id={eventInputId}
          name="event"
          value={selectedEventId}
          onChange={(event) => {
            setSelectedEventId(event.target.value);
            setQuery("");
          }}
          required
          className="mt-2 h-13 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 shadow-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-blue-100"
        >
          <option value="">
            {events.length ? "กรุณาเลือกกิจกรรม" : "ยังไม่มีกิจกรรมที่มีเกียรติบัตรเผยแพร่"}
          </option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>{event.name}</option>
          ))}
        </select>
      </label>
      <div className={compact ? "flex flex-col gap-3 sm:flex-row" : "space-y-4"}>
        <label className="sr-only" htmlFor={inputId}>
          ชื่อ–นามสกุล หรือเลขที่เกียรติบัตร
        </label>
        <div className="relative flex-1">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400"
          >
            ⌕
          </span>
          <input
            id={inputId}
            name="q"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={!selectedEventId}
            minLength={2}
            required
            placeholder={selectedEventId ? "ชื่อ–นามสกุล หรือเลขที่เกียรติบัตร" : "เลือกกิจกรรมก่อนค้นหา"}
            className="h-13 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
          />
        </div>
        <button
          type="submit"
          disabled={!selectedEventId || query.trim().length < 2}
          className="h-13 rounded-xl bg-brand px-8 font-semibold text-white shadow-lg shadow-blue-900/15 transition hover:-translate-y-0.5 hover:bg-brand-dark focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
        >
          ค้นหา
        </button>
      </div>
    </form>
  );
}
