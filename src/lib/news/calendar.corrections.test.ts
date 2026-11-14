import { describe, expect, it } from "vitest";
import { HIGH_IMPACT, mergeNewsEvents, parseCalendarCsv, type NewsEvent } from "./calendar";

function event(utc: number | null, extra: Partial<NewsEvent> = {}): NewsEvent {
  return { utc, dateNy: "2025-04-04", event: "Non-Farm Employment Change", impact: HIGH_IMPACT,
    actual: null, forecast: null, previous: null, ...extra };
}

describe("source-backed news time corrections", () => {
  it("parses missing-time and explicit-time replacement metadata", () => {
    const rows = parseCalendarCsv(
      "date_ny,datetime_utc,event,impact,supersedes_utc\n" +
      "2025-04-04,2025-04-04T12:30:00Z,NFP,High Impact Expected,missing\n" +
      "2025-04-04,2025-04-04T12:30:00Z,CPI,High Impact Expected,2025-04-04T11:30:00Z\n",
    );
    expect(rows[0]!.supersedesUtc).toBeNull();
    expect(rows[1]!.supersedesUtc).toBe(Date.parse("2025-04-04T11:30:00Z") / 1000);
  });

  it("removes the old clockless copy and stays idempotent", () => {
    const corrected = event(100, { supersedesUtc: null });
    const merged = mergeNewsEvents([event(null)], [corrected]);
    expect(merged).toEqual([corrected]);
    expect(mergeNewsEvents(merged, [corrected])).toEqual([corrected]);
  });

  it("replaces only the declared old timestamp and preserves a separate same-day event", () => {
    const corrected = event(100, { supersedesUtc: 90 });
    const other = event(200);
    expect(mergeNewsEvents([event(90), other], [corrected])).toEqual([corrected, other]);
  });

  it("keeps retired copies suppressed even if an old CSV is imported afterward", () => {
    const corrected = event(100, { supersedesUtc: null });
    expect(mergeNewsEvents([corrected], [event(null)])).toEqual([corrected]);
  });

  it("does not remove anything for malformed replacement metadata", () => {
    const parsed = parseCalendarCsv(
      "date_ny,datetime_utc,event,impact,supersedes_utc\n" +
      "2025-04-04,2025-04-04T12:30:00Z,NFP,High Impact Expected,invalid\n",
    );
    expect(parsed[0]!.supersedesUtc).toBeUndefined();
    expect(mergeNewsEvents([event(null)], parsed)).toHaveLength(2);
  });

  it("does not retire a cached event without a valid timed replacement", () => {
    const bad = event(null, { supersedesUtc: 100 });
    expect(mergeNewsEvents([event(100)], [bad])).toHaveLength(2);
  });
});
