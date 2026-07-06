import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  WasteEntry, WASTE_TYPES, getDaysStored, isDisposed, DisposalBatch,
  getMeasureUnit, unitLabel, sumByUnit, fmtNum,
} from "./wasteTypes";

const wasteName = (id: string) => WASTE_TYPES.find((w) => w.id === id)?.name ?? id;
const wasteCat = (id: string) => WASTE_TYPES.find((w) => w.id === id)?.category ?? "";
const wasteUnitLabel = (id: string) => unitLabel(getMeasureUnit(id));

function safeName(s: string) {
  return s.replace(/[^a-z0-9-_]+/gi, "_");
}

/**
 * Export current (in-storage) inventory to XLSX.
 * All quantities are reported as weight (kg for solids, litres for liquids).
 * A separate "Count" column carries the optional piece count for items measured in nos.
 */
export function exportInventoryToExcel(
  entries: WasteEntry[],
  siteName: string,
) {
  const inStorage = entries.filter((e) => !isDisposed(e));
  const totals = sumByUnit(inStorage);

  const detail = inStorage.map((e, i) => ({
    "Sl. No.": i + 1,
    "Date Generated": e.generated_date,
    "Location": e.location ?? "—",
    "Waste Description": wasteName(e.waste_type_id),
    "Physical Form": wasteCat(e.waste_type_id),
    "Category": e.waste_category === "hazardous" ? "Hazardous" : "Non-Hazardous",
    "Weight": Number(e.weight_kg ?? 0),
    "Unit": wasteUnitLabel(e.waste_type_id),
    "Count (pcs)": e.piece_count ?? "",
    "Source / Activity":
      e.activity_type === "preventive" ? "Preventive Maintenance"
      : e.activity_type === "breakdown" ? "Breakdown Maintenance"
      : "5S Activity",
    "Days in Storage": getDaysStored(e.generated_date),
    "Notes": e.notes ?? "",
  }));

  // By waste type (weight only)
  const byTypeMap = new Map<string, { kg: number; litres: number; pcs: number }>();
  inStorage.forEach((e) => {
    const k = wasteName(e.waste_type_id);
    const cur = byTypeMap.get(k) ?? { kg: 0, litres: 0, pcs: 0 };
    const u = getMeasureUnit(e.waste_type_id);
    const v = Number(e.weight_kg ?? 0);
    if (u === "kg") cur.kg += v; else cur.litres += v;
    cur.pcs += Number(e.piece_count ?? 0);
    byTypeMap.set(k, cur);
  });
  const byType = Array.from(byTypeMap.entries()).map(([name, v]) => ({
    "Waste Type": name,
    "Total Weight (kg)": +v.kg.toFixed(3),
    "Total Volume (L)": +v.litres.toFixed(3),
    "Total Pieces": v.pcs || "",
  }));

  // By location (kg + L)
  const byLocMap = new Map<string, { kg: number; litres: number }>();
  inStorage.forEach((e) => {
    const k = e.location ?? "Unspecified";
    const cur = byLocMap.get(k) ?? { kg: 0, litres: 0 };
    const u = getMeasureUnit(e.waste_type_id);
    const v = Number(e.weight_kg ?? 0);
    if (u === "kg") cur.kg += v; else cur.litres += v;
    byLocMap.set(k, cur);
  });
  const byLoc = Array.from(byLocMap.entries()).map(([loc, v]) => ({
    "Location": loc,
    "Weight (kg)": +v.kg.toFixed(3),
    "Volume (L)": +v.litres.toFixed(3),
  }));

  const meta = [
    ["Site", siteName],
    ["Report Type", "Hazardous Waste Inventory (Current Storage)"],
    ["Generated On", new Date().toLocaleString()],
    ["Total Weight in Storage (kg)", +totals.kg.toFixed(3)],
    ["Total Volume in Storage (L)", +totals.litres.toFixed(3)],
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meta), "Cover");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), "Inventory");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(byType), "By Waste Type");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(byLoc), "By Location");

  const date = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `WasteInventory_${safeName(siteName)}_${date}.xlsx`);
}

/**
 * Export Form 3 PDF (HOWM Rules format). Quantities are weight (kg / L).
 */
export function exportForm3Pdf(entries: WasteEntry[], siteName: string) {
  const inStorage = entries.filter((e) => !isDisposed(e));
  const totals = sumByUnit(inStorage);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFontSize(14).setFont("helvetica", "bold");
  doc.text("FORM 3", pageW / 2, 12, { align: "center" });
  doc.setFontSize(10).setFont("helvetica", "normal");
  doc.text(
    "[See rule 6(5), 13(8) and 20(2)]   Form for maintaining records of Hazardous and Other Wastes",
    pageW / 2, 18, { align: "center" },
  );

  doc.setFontSize(9);
  doc.text(`Name of the occupier / facility: ${siteName}`, 10, 26);
  doc.text(`Date of report: ${new Date().toLocaleDateString()}`, pageW - 10, 26, { align: "right" });
  doc.text(
    `Total in storage: ${fmtNum(totals.kg)} kg  ·  ${fmtNum(totals.litres)} L`,
    10, 31,
  );

  const head = [[
    "Sl.\nNo.",
    "Date of\nGeneration",
    "Source /\nProcess",
    "Location",
    "Waste Description",
    "Category /\nForm",
    "Weight",
    "Unit",
    "Count\n(pcs)",
    "Days in\nStorage",
    "Disposal Date /\nMode",
  ]];

  const body = inStorage.map((e, i) => [
    String(i + 1),
    e.generated_date,
    e.activity_type === "preventive" ? "PM" : e.activity_type === "breakdown" ? "BM" : "5S",
    e.location ?? "—",
    wasteName(e.waste_type_id),
    `${e.waste_category === "hazardous" ? "Haz" : "Non-Haz"} / ${wasteCat(e.waste_type_id)}`,
    fmtNum(Number(e.weight_kg ?? 0)),
    wasteUnitLabel(e.waste_type_id),
    e.piece_count != null ? String(e.piece_count) : "—",
    String(getDaysStored(e.generated_date)),
    "— (In storage)",
  ]);

  autoTable(doc, {
    startY: 36,
    head,
    body,
    styles: { fontSize: 8, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.1 },
    headStyles: { fillColor: [220, 230, 220], textColor: 20, fontStyle: "bold", halign: "center" },
    bodyStyles: { valign: "middle" },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { cellWidth: 22 },
      2: { cellWidth: 20 },
      3: { cellWidth: 24 },
      4: { cellWidth: 48 },
      5: { cellWidth: 28 },
      6: { halign: "right", cellWidth: 18 },
      7: { halign: "center", cellWidth: 12 },
      8: { halign: "center", cellWidth: 14 },
      9: { halign: "center", cellWidth: 16 },
    },
    didDrawPage: () => {
      const ph = doc.internal.pageSize.getHeight();
      doc.setFontSize(8).setTextColor(120);
      doc.text(
        `Page ${doc.getNumberOfPages()}   •   Generated by Hazardous Waste Tracker`,
        pageW / 2, ph - 6, { align: "center" },
      );
      doc.setTextColor(0);
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? 36;
  if (finalY < doc.internal.pageSize.getHeight() - 30) {
    doc.setFontSize(9);
    doc.text("Signature of authorised person: ____________________________", 10, finalY + 18);
    doc.text("Date: ______________", pageW - 60, finalY + 18);
  }

  const date = new Date().toISOString().split("T")[0];
  doc.save(`Form3_${safeName(siteName)}_${date}.pdf`);
}

/**
 * Export a disposal-batch manifest PDF. Totals reported as kg + L.
 */
export function exportDisposalBatchPdf(
  batch: DisposalBatch,
  batchEntries: WasteEntry[],
  siteName: string,
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const totals = sumByUnit(batchEntries);

  doc.setFontSize(15).setFont("helvetica", "bold");
  doc.text("DISPOSAL MANIFEST", pageW / 2, 14, { align: "center" });
  doc.setFontSize(9).setFont("helvetica", "normal");
  doc.text("Hazardous & Non-Hazardous Waste — Quarterly Disposal Record", pageW / 2, 20, { align: "center" });

  doc.setFontSize(9);
  doc.text(`Facility / Site: ${siteName}`, 10, 30);
  doc.text(`Disposal Date: ${batch.disposed_date}`, 10, 35);
  doc.text(`Batch ID: ${batch.id.slice(0, 8).toUpperCase()}`, pageW - 10, 30, { align: "right" });
  doc.text(
    `Total Disposed: ${fmtNum(totals.kg)} kg  ·  ${fmtNum(totals.litres)} L`,
    pageW - 10, 35, { align: "right" },
  );
  if (batch.notes) {
    doc.text(`Notes: ${batch.notes}`, 10, 40, { maxWidth: pageW - 20 });
  }

  const disposedAt = new Date(batch.disposed_date).getTime();
  const daysHeld = (gen: string) =>
    Math.max(0, Math.floor((disposedAt - new Date(gen).getTime()) / (1000 * 60 * 60 * 24)));

  const body = batchEntries.map((e, i) => [
    String(i + 1),
    e.generated_date,
    e.location ?? "—",
    wasteName(e.waste_type_id),
    e.waste_category === "hazardous" ? "Haz" : "Non-Haz",
    `${fmtNum(Number(e.weight_kg ?? 0))} ${wasteUnitLabel(e.waste_type_id)}`,
    e.piece_count != null ? String(e.piece_count) : "—",
    String(daysHeld(e.generated_date)),
    e.activity_type === "preventive" ? "PM" : e.activity_type === "breakdown" ? "BM" : "5S",
  ]);

  autoTable(doc, {
    startY: batch.notes ? 46 : 42,
    head: [["#", "Generated", "Location", "Waste Type", "Cat", "Weight", "Pcs", "Days Held", "Src"]],
    body,
    styles: { fontSize: 8, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.1 },
    headStyles: { fillColor: [220, 230, 220], textColor: 20, fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { cellWidth: 22 },
      2: { cellWidth: 24 },
      3: { cellWidth: 46 },
      4: { halign: "center", cellWidth: 14 },
      5: { halign: "right", cellWidth: 22 },
      6: { halign: "center", cellWidth: 12 },
      7: { halign: "center", cellWidth: 16 },
      8: { halign: "center", cellWidth: 12 },
    },
  });

  // Totals by waste type in weight
  const map = new Map<string, { kg: number; litres: number }>();
  batchEntries.forEach((e) => {
    const k = wasteName(e.waste_type_id);
    const cur = map.get(k) ?? { kg: 0, litres: 0 };
    const u = getMeasureUnit(e.waste_type_id);
    const v = Number(e.weight_kg ?? 0);
    if (u === "kg") cur.kg += v; else cur.litres += v;
    map.set(k, cur);
  });
  const totalsBody = Array.from(map.entries()).map(([n, v]) => [
    n,
    v.kg > 0 ? `${v.kg.toFixed(2)} kg` : v.litres > 0 ? `${v.litres.toFixed(2)} L` : "—",
  ]);
  const y1 = (doc as any).lastAutoTable?.finalY ?? 60;
  autoTable(doc, {
    startY: y1 + 6,
    head: [["Waste Type", "Total Disposed"]],
    body: totalsBody,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [31, 107, 58], textColor: 255, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right", cellWidth: 40 } },
    margin: { left: 10, right: 10 },
  });

  const y2 = (doc as any).lastAutoTable?.finalY ?? y1 + 40;
  const ph = doc.internal.pageSize.getHeight();
  const sigY = Math.min(y2 + 20, ph - 25);
  doc.setFontSize(9);
  doc.text("Authorised Signatory: ____________________________", 10, sigY);
  doc.text("TSDF / Transporter: ____________________________", 10, sigY + 8);
  doc.text("Manifest No.: ____________________________", pageW - 90, sigY + 8);

  doc.setFontSize(7).setTextColor(120);
  doc.text("Generated by Hazardous Waste Tracker", pageW / 2, ph - 6, { align: "center" });

  doc.save(`DisposalManifest_${safeName(siteName)}_${batch.disposed_date}.pdf`);
}
