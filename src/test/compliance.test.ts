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
