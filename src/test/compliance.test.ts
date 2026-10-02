import { describe, it, expect, beforeEach } from "vitest";
import {
  getStorageLimitDays,
  getStatutoryCode,
  isEntryOverdue,
  isEntryWarning,
  getStatus,
  sumByUnit,
  WasteEntry,
  WASTE_TYPES,
  parseLocalDate,
  formatDateDDMMYYYY,
  formatDateTimeDDMMYYYY,
} from "@/lib/wasteTypes";
import {
  saveToPendingQueue,
  getPendingQueue,
  removeFromPendingQueue,
  clearPendingQueue,
  PendingEntry,
} from "@/lib/offlineSync";

describe("Statutory EHS Rules Compliance Engine", () => {
  it("applies correct statutory storage limits by waste category", () => {
    expect(getStorageLimitDays("hazardous")).toBe(90); // HOWM Rules 2016 Rule 8
    expect(getStorageLimitDays("e_waste")).toBe(180); // E-Waste Management Rules 2022
    expect(getStorageLimitDays("e_waste", "used-batteries")).toBe(180); // Battery Waste Rules 2022
    expect(getStorageLimitDays("non_hazardous")).toBe(180); // Non-hazardous housekeeping
  });

  it("maps official CPCB Schedule I & II codes", () => {
    expect(getStatutoryCode("waste-oil")).toBe("Sch-I 5.1");
    expect(getStatutoryCode("waste-grease")).toBe("Sch-I 5.1");
    expect(getStatutoryCode("oil-cotton")).toBe("Sch-I 5.2");
    expect(getStatutoryCode("empty-containers")).toBe("Sch-I 33.1");
    expect(getStatutoryCode("plastic-waste")).toBe("Sch-I 33.1");
    expect(getStatutoryCode("dust-filter-mat")).toBe("Sch-I 35.3");
    expect(getStatutoryCode("carbon-brush")).toBe("Sch-II B17");
    expect(getStatutoryCode("used-batteries")).toBe("BWM 2022");
  });

  it("calculates statutory overdue status correctly per category", () => {
    const today = new Date();
    const ninetyOneDaysAgo = new Date(today.getTime() - 91 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const oneHundredDaysAgo = new Date(today.getTime() - 100 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const hazEntry: WasteEntry = {
      id: "h-1",
      site_id: "site-1",
      waste_type_id: "waste-oil",
      waste_category: "hazardous",
      weight_kg: 200,
      generated_date: ninetyOneDaysAgo,
      activity_type: "preventive",
    };

    // Hazardous waste at 91 days is overdue under HOWM 2016 (limit: 90 days)
    expect(isEntryOverdue(hazEntry)).toBe(true);
    expect(getStatus(hazEntry)).toBe("overdue");

    const eWasteEntry: WasteEntry = {
      id: "e-1",
      site_id: "site-1",
      waste_type_id: "used-batteries",
      waste_category: "e_waste",
      weight_kg: 50,
      generated_date: oneHundredDaysAgo,
      activity_type: "preventive",
    };

    // E-waste at 100 days is SAFE under E-Waste Rules 2022 (limit: 180 days)
    expect(isEntryOverdue(eWasteEntry)).toBe(false);
    expect(getStatus(eWasteEntry)).toBe("safe");
  });

  it("sums solid (kg) and liquid (litres) units independently without conflation", () => {
    const entries: WasteEntry[] = [
      {
        id: "1",
        site_id: "s1",
        waste_type_id: "waste-oil", // liquid -> litres
        waste_category: "hazardous",
        weight_kg: 100,
        generated_date: "2026-09-01",
        activity_type: "preventive",
      },
      {
        id: "2",
        site_id: "s1",
        waste_type_id: "oil-cotton", // solid -> kg
        waste_category: "hazardous",
        weight_kg: 45,
        generated_date: "2026-09-01",
        activity_type: "preventive",
      },
      {
        id: "3",
        site_id: "s1",
        waste_type_id: "aluminium-scrap", // solid -> kg
        waste_category: "other_wastes",
        weight_kg: 55,
        generated_date: "2026-09-01",
        activity_type: "preventive",
      },
    ];

    const result = sumByUnit(entries);
    expect(result.litres).toBe(100);
    expect(result.kg).toBe(100);
  });
});

describe("Offline Mutation Sync Queue", () => {
  beforeEach(() => {
    clearPendingQueue();
  });

  it("enqueues and retrieves offline entries in localStorage", () => {
    const item: PendingEntry = {
      tempId: "temp-entry-1",
      siteId: "test-site-123",
      userId: "test-user-456",
      timestamp: Date.now(),
      data: {
        waste_type_id: "oil-cotton",
        waste_category: "hazardous",
        weight_kg: 25,
        generated_date: "2026-09-29",
        activity_type: "preventive",
      },
    };

    saveToPendingQueue(item);

    const queue = getPendingQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].data.weight_kg).toBe(25);

    removeFromPendingQueue(item.tempId);
    expect(getPendingQueue().length).toBe(0);
  });
});

describe("Physical Generation Date Attribution (generated_date vs created_at)", () => {
  it("parses local date strings at local midnight without UTC skew", () => {
    const d = parseLocalDate("2026-10-02");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9); // 0-indexed October
    expect(d.getDate()).toBe(2);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it("strictly places delayed/retroactive entries into their physical generation week, ignoring entry date", () => {
    // Technician generated 40kg of waste on Monday 2026-09-21 in the wind turbine
    // but only logged it on Friday 2026-10-02 (2 weeks later)
    const delayedEntry: WasteEntry = {
      id: "delayed-1",
      site_id: "site-1",
      waste_type_id: "oil-cotton",
      waste_category: "hazardous",
      weight_kg: 40,
      generated_date: "2026-09-21", // Physical generation date (Week 38)
      activity_type: "preventive",
      created_at: "2026-10-02T10:30:00Z", // Entry date (Week 40)
    };

    const week38Start = parseLocalDate("2026-09-21");
    const week38End = new Date(week38Start);
    week38End.setDate(week38End.getDate() + 6);
    week38End.setHours(23, 59, 59, 999);

    const week40Start = parseLocalDate("2026-09-28");
    const week40End = new Date(week40Start);
    week40End.setDate(week40End.getDate() + 6);
    week40End.setHours(23, 59, 59, 999);

    const genDate = parseLocalDate(delayedEntry.generated_date);

    // Entry MUST match Week 38 (when work occurred)
    expect(genDate >= week38Start && genDate <= week38End).toBe(true);

    // Entry MUST NOT match Week 40 (when user typed it)
    expect(genDate >= week40Start && genDate <= week40End).toBe(false);

    // Verify retroactive entry detection
    const isRetroactive = delayedEntry.created_at!.slice(0, 10) > delayedEntry.generated_date;
    expect(isRetroactive).toBe(true);
  });
});

describe("Global DD-MM-YYYY Date Formatting Standard", () => {
  it("formats YYYY-MM-DD date strings into DD-MM-YYYY", () => {
    expect(formatDateDDMMYYYY("2026-10-02")).toBe("02-10-2026");
    expect(formatDateDDMMYYYY("2026-05-09")).toBe("09-05-2026");
    expect(formatDateDDMMYYYY("2025-12-31")).toBe("31-12-2025");
  });

  it("formats Date objects into DD-MM-YYYY", () => {
    const d = new Date(2026, 9, 2); // 2nd October 2026
    expect(formatDateDDMMYYYY(d)).toBe("02-10-2026");
  });

  it("handles null, undefined, or empty values gracefully with fallback", () => {
    expect(formatDateDDMMYYYY(null)).toBe("—");
    expect(formatDateDDMMYYYY(undefined)).toBe("—");
    expect(formatDateDDMMYYYY("")).toBe("—");
  });

  it("formats timestamp strings into DD-MM-YYYY HH:mm", () => {
    const formatted = formatDateTimeDDMMYYYY("2026-10-02T10:30:00Z");
    expect(formatted).toMatch(/^\d{2}-\d{2}-2026 \d{2}:\d{2}$/);
  });
});

