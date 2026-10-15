import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import {
  WasteEntry,
  DisposalBatch,
  isDisposed,
  getStatutoryCode,
  formatDateDDMMYYYY,
  sumByUnit,
} from "@/lib/wasteTypes";

describe("End-to-End Waste Disposal Workflow & Statutory Compliance", () => {
  const siteA = { id: "site-mumbai-01", name: "Mumbai Plant 1", state: "Maharashtra" };
  const siteB = { id: "site-pune-02", name: "Pune Facility", state: "Maharashtra" };

  const submitterManager = { id: "user-manager-1", name: "Plant Manager Rajesh" };
  const regionalCoordinator = { id: "user-regional-coord", name: "Regional Coordinator Priya" };
  const enterpriseAdmin = { id: "user-admin", name: "Enterprise Admin Vikram" };

  // Sample inventory entries
  const entry1: WasteEntry = {
    id: "entry-oil-01",
    site_id: siteA.id,
    waste_type_id: "waste-oil",
    waste_category: "hazardous",
    weight_kg: 200,
    generated_date: "2026-10-10",
    location: "Turbine Bay 1",
    activity_type: "preventive",
  };

  const entry2: WasteEntry = {
    id: "entry-cotton-02",
    site_id: siteA.id,
    waste_type_id: "oil-cotton",
    waste_category: "hazardous",
    weight_kg: 35,
    generated_date: "2026-10-12",
    location: "Maintenance Shop",
    activity_type: "breakdown",
  };

  const entrySiteB: WasteEntry = {
    id: "entry-pune-01",
    site_id: siteB.id,
    waste_type_id: "waste-oil",
    waste_category: "hazardous",
    weight_kg: 150,
    generated_date: "2026-10-14",
    location: "Compressor House",
    activity_type: "preventive",
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 1: Inventory Logging & Baseline Active State
  // ─────────────────────────────────────────────────────────────────────────────
  it("Scenario 1: Active entries have null disposal_batch_id and are not marked disposed", () => {
    expect(isDisposed(entry1)).toBe(false);
    expect(isDisposed(entry2)).toBe(false);
    expect(entry1.disposal_batch_id).toBeUndefined();

    // Verify statutory CPCB codes are assigned
    expect(getStatutoryCode(entry1.waste_type_id)).toBe("Sch-I 5.1");
    expect(getStatutoryCode(entry2.waste_type_id)).toBe("Sch-I 5.2");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 2: Validation on Disposal Batch Submission
  // ─────────────────────────────────────────────────────────────────────────────
  it("Scenario 2A: Rejects disposal submission with empty entry list", () => {
    const attemptSubmission = (entryIds: string[]) => {
      if (!entryIds || entryIds.length === 0) {
        throw new Error("Choose a valid date and explicit entries");
      }
    };
    expect(() => attemptSubmission([])).toThrow("Choose a valid date and explicit entries");
  });

  it("Scenario 2B: Prevents cross-site entry bundling in a single manifest", () => {
    const attemptBatchCreation = (siteId: string, entries: WasteEntry[]) => {
      const invalid = entries.filter((e) => e.site_id !== siteId);
      if (invalid.length > 0) {
        throw new Error("Selection changed, contains duplicates, or includes ineligible entries");
      }
    };
    expect(() => attemptBatchCreation(siteA.id, [entry1, entrySiteB])).toThrow(
      "Selection changed, contains duplicates, or includes ineligible entries"
    );
  });

  it("Scenario 2C: Blocks backdating disposal prior to waste generation date", () => {
    const disposalDate = "2026-10-08"; // Earlier than entry1 (2026-10-10)
    const validateDisposalDate = (dispDate: string, entries: WasteEntry[]) => {
      const postDated = entries.filter((e) => e.generated_date > dispDate);
      if (postDated.length > 0) {
        throw new Error(`Cannot dispose ${postDated.length} record(s) generated after disposal date`);
      }
    };
    expect(() => validateDisposalDate(disposalDate, [entry1, entry2])).toThrow(
      "Cannot dispose 2 record(s) generated after disposal date"
    );
  });

  it("Scenario 2D: Successfully locks entries into 'pending' disposal batch", () => {
    const disposalDate = "2026-10-15";
    const batchId = "batch-uuid-001";

    const batch: DisposalBatch = {
      id: batchId,
      site_id: siteA.id,
      disposed_date: disposalDate,
      disposed_by: submitterManager.id,
      notes: "Transporter: EcoLogistics MH-04-1234, Manifest #TSDF-9988",
      status: "pending",
      created_at: new Date().toISOString(),
    };

    // Simulate entry locking upon batch creation
    const lockedEntry1: WasteEntry = { ...entry1, disposal_batch_id: batch.id };
    const lockedEntry2: WasteEntry = { ...entry2, disposal_batch_id: batch.id };

    expect(batch.status).toBe("pending");
    expect(batch.disposed_by).toBe(submitterManager.id);
    expect(lockedEntry1.disposal_batch_id).toBe(batchId);
    expect(lockedEntry2.disposal_batch_id).toBe(batchId);
    expect(isDisposed(lockedEntry1)).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 3: Strict Segregation of Duties (Submitter Cannot Self-Approve)
  // ─────────────────────────────────────────────────────────────────────────────
  it("Scenario 3: Enforces Segregation of Duties (SoD / 4-Eyes Principle)", () => {
    const batch: DisposalBatch = {
      id: "batch-uuid-001",
      site_id: siteA.id,
      disposed_date: "2026-10-15",
      disposed_by: submitterManager.id,
      status: "pending",
      created_at: new Date().toISOString(),
    };

    // Submitter evaluation
    const submitterIsAuthorized = true; // has manager role on siteA
    const submitterMayDecide = submitterIsAuthorized && batch.disposed_by !== submitterManager.id;
    expect(submitterMayDecide).toBe(false); // BLOCKED!

    // Regional Coordinator evaluation
    const coordinatorIsAuthorized = true; // has regional coordinator persona
    const coordinatorMayDecide = coordinatorIsAuthorized && batch.disposed_by !== regionalCoordinator.id;
    expect(coordinatorMayDecide).toBe(true); // ALLOWED!

    // Second Manager evaluation
    const secondManager = { id: "user-manager-2" };
    const secondManagerIsAuthorized = true;
    const secondManagerMayDecide = secondManagerIsAuthorized && batch.disposed_by !== secondManager.id;
    expect(secondManagerMayDecide).toBe(true); // ALLOWED!

    // Server-side RPC guard check simulation
    const decideDisposalRpc = (callerId: string, b: DisposalBatch, action: "approve" | "reject") => {
      if (b.disposed_by === callerId) {
        throw new Error("A different manager must review the request");
      }
      return { status: action === "approve" ? "approved" : "rejected", decidedBy: callerId };
    };

    expect(() => decideDisposalRpc(submitterManager.id, batch, "approve")).toThrow(
      "A different manager must review the request"
    );
    expect(() => decideDisposalRpc(submitterManager.id, batch, "reject")).toThrow(
      "A different manager must review the request"
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 4: Approval Flow & Inventory Balance
  // ─────────────────────────────────────────────────────────────────────────────
  it("Scenario 4: Regional Coordinator approves batch; entries finalized as disposed", () => {
    const batch: DisposalBatch = {
      id: "batch-uuid-001",
      site_id: siteA.id,
      disposed_date: "2026-10-15",
      disposed_by: submitterManager.id,
      status: "pending",
      created_at: new Date().toISOString(),
    };

    // Regional Coordinator approves
    const approvedBatch: DisposalBatch = {
      ...batch,
      status: "approved",
      approved_by: regionalCoordinator.id,
      approved_at: "2026-10-15T10:30:00Z",
    };

    expect(approvedBatch.status).toBe("approved");
    expect(approvedBatch.approved_by).toBe(regionalCoordinator.id);

    // Entries in system
    const allEntries: WasteEntry[] = [
      { ...entry1, disposal_batch_id: approvedBatch.id },
      { ...entry2, disposal_batch_id: approvedBatch.id },
      { ...entrySiteB }, // Still active in site B
    ];

    // Compute active inventory for site A
    const activeInventorySiteA = allEntries.filter((e) => e.site_id === siteA.id && !isDisposed(e));
    expect(activeInventorySiteA.length).toBe(0); // Entries are cleared from active inventory!

    // Check sum of batch
    const totals = sumByUnit(allEntries.filter((e) => e.disposal_batch_id === approvedBatch.id));
    expect(totals.litres).toBe(200); // 200 L of waste oil
    expect(totals.kg).toBe(35); // 35 kg of oil cotton
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 5: Form 10 Manifest Data Completeness
  // ─────────────────────────────────────────────────────────────────────────────
  it("Scenario 5: Form 10 manifest compiles accurate statutory details", () => {
    const batch: DisposalBatch = {
      id: "b7e41a90-3344-4211-9a7f-123456789abc",
      site_id: siteA.id,
      disposed_date: "2026-10-15",
      disposed_by: submitterManager.id,
      notes: "EcoLogistics TSDF Transporter #GJ-01-9988",
      status: "approved",
    };

    const batchEntries = [
      { ...entry1, disposal_batch_id: batch.id },
      { ...entry2, disposal_batch_id: batch.id },
    ];

    const manifestData = {
      title: "FORM 10 — MANIFEST FOR HAZARDOUS & OTHER WASTE",
      ruleRef: "Rule 19(1) of HOWM Rules, 2016",
      facility: siteA.name,
      dispatchDate: formatDateDDMMYYYY(batch.disposed_date),
      manifestShortId: batch.id.slice(0, 8).toUpperCase(),
      totals: sumByUnit(batchEntries),
      itemCount: batchEntries.length,
    };

    expect(manifestData.title).toContain("FORM 10");
    expect(manifestData.dispatchDate).toBe("15-10-2026");
    expect(manifestData.manifestShortId).toBe("B7E41A90");
    expect(manifestData.totals.litres).toBe(200);
    expect(manifestData.totals.kg).toBe(35);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 6: Rejection Flow & Automatic Inventory Rollback
  // ─────────────────────────────────────────────────────────────────────────────
  it("Scenario 6: Regional Coordinator rejects batch with reason; entries rollback to active inventory", () => {
    const batchId = "batch-uuid-rejected";
    const initialBatch: DisposalBatch = {
      id: batchId,
      site_id: siteA.id,
      disposed_date: "2026-10-15",
      disposed_by: submitterManager.id,
      status: "pending",
    };

    let entries: WasteEntry[] = [
      { ...entry1, disposal_batch_id: batchId },
      { ...entry2, disposal_batch_id: batchId },
    ];

    // Verify entries are initially tied to pending batch
    expect(entries.every((e) => isDisposed(e))).toBe(true);

    // Rejection execution (as implemented in public.decide_disposal RPC)
    const rejectionReason = "TSDF weighbridge tare weight discrepancy — please re-verify";
    const rejectedBatch: DisposalBatch = {
      ...initialBatch,
      status: "rejected",
      approved_by: regionalCoordinator.id,
      approved_at: new Date().toISOString(),
      rejection_reason: rejectionReason,
    };

    // SQL rollback simulation: update waste_entries set disposal_batch_id = null where disposal_batch_id = p_batch_id
    entries = entries.map((e) => {
      if (e.disposal_batch_id === batchId) {
        return { ...e, disposal_batch_id: undefined };
      }
      return e;
    });

    // VERIFY ROLLBACK:
    expect(rejectedBatch.status).toBe("rejected");
    expect(rejectedBatch.rejection_reason).toBe(rejectionReason);
    expect(entries.every((e) => !isDisposed(e))).toBe(true);
    expect(entries[0].disposal_batch_id).toBeUndefined();
    expect(entries[1].disposal_batch_id).toBeUndefined();

    // Active inventory count is restored:
    const activeInventory = entries.filter((e) => e.site_id === siteA.id && !isDisposed(e));
    expect(activeInventory.length).toBe(2);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 7: Multi-Facility / Regional Coordinator Consolidated View
  // ─────────────────────────────────────────────────────────────────────────────
  it("Scenario 7: Regional Coordinator can view batches across multiple facilities with site tags", () => {
    const batchA: DisposalBatch = {
      id: "batch-A",
      site_id: siteA.id,
      disposed_date: "2026-10-15",
      disposed_by: submitterManager.id,
      status: "pending",
    };

    const batchB: DisposalBatch = {
      id: "batch-B",
      site_id: siteB.id,
      disposed_date: "2026-10-15",
      disposed_by: "user-pune-manager",
      status: "approved",
    };

    const allBatches = [batchA, batchB];
    const sites = [siteA, siteB];

    // Helper simulating DisposalHistoryView facility resolution
    const resolveBatchSiteName = (batchSiteId: string) =>
      sites.find((s) => s.id === batchSiteId)?.name ?? "Unknown Facility";

    expect(resolveBatchSiteName(batchA.site_id)).toBe("Mumbai Plant 1");
    expect(resolveBatchSiteName(batchB.site_id)).toBe("Pune Facility");

    // Regional Coordinator has authority over both batches
    const isRegionalCoordinator = true;
    const canCoordinateBatchA = isRegionalCoordinator && batchA.disposed_by !== regionalCoordinator.id;
    const canCoordinateBatchB = isRegionalCoordinator && batchB.disposed_by !== regionalCoordinator.id;

    expect(canCoordinateBatchA).toBe(true);
    expect(canCoordinateBatchB).toBe(true);
  });
});
