import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { WasteEntry, WASTE_TYPES, getDaysStored, isDisposed } from "./wasteTypes";

const wasteName = (id: string) => WASTE_TYPES.find((w) => w.id === id)?.name ?? id;
const wasteUnit = (id: string) => WASTE_TYPES.find((w) => w.id === id)?.unit ?? "";
const wasteCat = (id: string) => WASTE_TYPES.find((w) => w.id === id)?.category ?? "";

function safeName(s: string) {
  return s.replace(/[^a-z0-9-_]+/gi, "_");
}

/**
 * Export current (in-storage) inventory to XLSX.
 * Sheet 1: Detailed line items.
 * Sheet 2: Summary by waste type.
 * Sheet 3: Summary by location.
 */
export function exportInventoryToExcel(
  entries: WasteEntry[],
  siteName: string,
) {
  const inStorage = entries.filter((e) => !isDisposed(e));

  const detail = inStorage.map((e, i) => ({
    "Sl. No.": i + 1,
    "Date Generated": e.generated_date,
    "WTG / Turbine ID": e.location,
    "Location": e.location ?? "—",
    "Waste Description": wasteName(e.waste_type_id),
    "Physical Form": wasteCat(e.waste_type_id),
    "Category": e.waste_category === "hazardous" ? "Hazardous" : "Non-Hazardous",
    "Quantity": Number(e.quantity),
    "Unit": wasteUnit(e.waste_type_id),
    "Source / Activity":
      e.activity_type === "preventive" ? "Preventive Maintenance" : "Breakdown Maintenance",
    "Days in Storage": getDaysStored(e.generated_date),
    "Notes": e.notes ?? "",
  }));

  const byTypeMap = new Map<string, { qty: number; unit: string; entries: number }>();
  inStorage.forEach((e) => {
    const k = wasteName(e.waste_type_id);
    const cur = byTypeMap.get(k) ?? { qty: 0, unit: wasteUnit(e.waste_type_id), entries: 0 };
    cur.qty += Number(e.quantity);
    cur.entries += 1;
    byTypeMap.set(k, cur);
  });
  const byType = Array.from(byTypeMap.entries()).map(([name, v]) => ({
    "Waste Type": name,
    "Total Quantity": Number(v.qty.toFixed(3)),
    "Unit": v.unit,
    "# Entries": v.entries,
  }));

  const byLocMap = new Map<string, { qty: number; entries: number }>();
  inStorage.forEach((e) => {
    const k = e.location ?? "Unspecified";
    const cur = byLocMap.get(k) ?? { qty: 0, entries: 0 };
    cur.qty += Number(e.quantity);
    cur.entries += 1;
    byLocMap.set(k, cur);
  });
  const byLoc = Array.from(byLocMap.entries()).map(([loc, v]) => ({
    "Location": loc,
    "Total Quantity (mixed units)": Number(v.qty.toFixed(3)),
    "# Entries": v.entries,
  }));

  const meta = [
    ["Site", siteName],
    ["Report Type", "Hazardous Waste Inventory (Current Storage)"],
    ["Generated On", new Date().toLocaleString()],
    ["Total Active Entries", inStorage.length],
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
 * Export "FORM 3 — Record of Hazardous Wastes" (HOWM Rules format) as PDF.
 * Lists current inventory in the prescribed columns.
 * (Generic layout — share the official template image to fine-tune.)
 */
export function exportForm3Pdf(entries: WasteEntry[], siteName: string) {
  const inStorage = entries.filter((e) => !isDisposed(e));
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // Header band
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
  doc.text(`Total entries in storage: ${inStorage.length}`, 10, 31);

  const head = [[
    "Sl.\nNo.",
    "Date of\nGeneration",
    "Source /\nProcess",
    "Location",
    "Waste Description",
    "Category /\nForm",
    "Quantity",
    "Unit",
    "Days in\nStorage",
    "Disposal Date /\nMode",
  ]];

  const body = inStorage.map((e, i) => [
    String(i + 1),
    e.generated_date,
    `${e.location}\n(${e.activity_type === "preventive" ? "PM" : "BM"})`,
    e.location ?? "—",
    wasteName(e.waste_type_id),
    `${e.waste_category === "hazardous" ? "Haz" : "Non-Haz"} / ${wasteCat(e.waste_type_id)}`,
    String(e.quantity),
    wasteUnit(e.waste_type_id),
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
      0: { halign: "center", cellWidth: 12 },
      1: { cellWidth: 24 },
      2: { cellWidth: 28 },
      3: { cellWidth: 26 },
      4: { cellWidth: 50 },
      5: { cellWidth: 30 },
      6: { halign: "right", cellWidth: 18 },
      7: { halign: "center", cellWidth: 14 },
      8: { halign: "center", cellWidth: 18 },
    },
    didDrawPage: (data) => {
      const ph = doc.internal.pageSize.getHeight();
      doc.setFontSize(8).setTextColor(120);
      doc.text(
        `Page ${doc.getNumberOfPages()}   •   Generated by Hazardous Waste Tracker`,
        pageW / 2, ph - 6, { align: "center" },
      );
      doc.setTextColor(0);
    },
  });

  // Signature block
  const finalY = (doc as any).lastAutoTable?.finalY ?? 36;
  if (finalY < doc.internal.pageSize.getHeight() - 30) {
    doc.setFontSize(9);
    doc.text("Signature of authorised person: ____________________________", 10, finalY + 18);
    doc.text("Date: ______________", pageW - 60, finalY + 18);
  }

  const date = new Date().toISOString().split("T")[0];
  doc.save(`Form3_${safeName(siteName)}_${date}.pdf`);
}
