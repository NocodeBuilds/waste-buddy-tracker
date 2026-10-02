import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  WasteEntry, WASTE_TYPES, getMeasureUnit, unitLabel, sumByUnit, fmtNum,
  getDaysStored, isDisposed, DisposalBatch,
  filterByPeriod, AnalyticsPeriod, formatDateDDMMYYYY,
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
  period?: AnalyticsPeriod,
) {
  const source = period ? filterByPeriod(entries, period) : entries;
  const inStorage = source.filter((e) => !isDisposed(e));
  const totals = sumByUnit(inStorage);

  const detail = inStorage.map((e, i) => ({
    "Sl. No.": i + 1,
    "Date Generated": formatDateDDMMYYYY(e.generated_date),
    "Location": e.location ?? "—",
    "Waste Description": wasteName(e.waste_type_id),
    "Physical Form": wasteCat(e.waste_type_id),
    "Category": e.waste_category === "hazardous" ? "Hazardous"
      : e.waste_category === "non_hazardous" ? "Non-Hazardous"
      : "Other Wastes",
    "Weight": Number(e.weight_kg ?? 0),
    "Unit": wasteUnitLabel(e.waste_type_id),
    "Count (pcs)": e.piece_count ?? "",
    "Source / Activity":
      e.activity_type === "preventive" ? "Preventive Maintenance"
      : e.activity_type === "breakdown" ? "Breakdown Maintenance"
      : e.activity_type === "5s" ? "5S Activity"
      : "Others",
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

  const safePeriod = period ? period.label.replace(/[^a-z0-9_-]+/gi, "_") : "";
  const suffix = safePeriod ? `_${safePeriod}` : "";
  XLSX.writeFile(wb, `Inventory_${safeName(siteName)}${suffix}.xlsx`);
}

/**
 * Export Form 3 PDF (HOWM Rules format). Quantities are weight (kg / L).
 */
export function exportForm3Pdf(entries: WasteEntry[], siteName: string, period?: AnalyticsPeriod) {
  const source = period ? filterByPeriod(entries, period) : entries;
  const inStorage = source.filter((e) => !isDisposed(e));
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
  if (period && period.kind !== "all") {
    doc.text(`Period: ${period.label}`, 10, 31);
  }
  doc.text(
    `Total in storage: ${fmtNum(totals.kg)} kg  ·  ${fmtNum(totals.litres)} L`,
    10, period && period.kind !== "all" ? 36 : 31,
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
    formatDateDDMMYYYY(e.generated_date),
    e.activity_type === "preventive" ? "PM" : e.activity_type === "breakdown" ? "BM" : e.activity_type === "5s" ? "5S" : "Others",
    e.location ?? "—",
    wasteName(e.waste_type_id),
    `${e.waste_category === "hazardous" ? "Haz" : e.waste_category === "non_hazardous" ? "Non-Haz" : "Other"} / ${wasteCat(e.waste_type_id)}`,
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
        `Page ${doc.getNumberOfPages()}   •   Generated by WasteBuddy Enterprise Portal`,
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
  const safePeriod = period && period.kind !== "all" ? `_${period.label.replace(/[^a-z0-9_-]+/gi, "_")}` : "";
  doc.save(`Form3_${safeName(siteName)}${safePeriod}_${date}.pdf`);
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

  doc.setFontSize(14).setFont("helvetica", "bold");
  doc.text("FORM 10 — MANIFEST FOR HAZARDOUS & OTHER WASTE", pageW / 2, 14, { align: "center" });
  doc.setFontSize(8).setFont("helvetica", "normal");
  doc.text("[See Rule 19(1) of HOWM Rules, 2016 — Movement Document for Waste Transport]", pageW / 2, 19, { align: "center" });

  doc.setFontSize(8.5);
  doc.text(`Generating Facility / Site: ${siteName}`, 10, 28);
  doc.text(`Disposal / Dispatch Date: ${formatDateDDMMYYYY(batch.disposed_date)}`, 10, 33);
  doc.text(`Manifest / Batch ID: ${batch.id.slice(0, 8).toUpperCase()}`, pageW - 10, 28, { align: "right" });
  doc.text(
    `Total Dispatched: ${fmtNum(totals.kg)} kg  ·  ${fmtNum(totals.litres)} L`,
    pageW - 10, 33, { align: "right" },
  );
  if (batch.notes) {
    doc.text(`Transporter / Manifest Details: ${batch.notes}`, 10, 38, { maxWidth: pageW - 20 });
  }

  const disposedAt = new Date(batch.disposed_date).getTime();
  const daysHeld = (gen: string) =>
    Math.max(0, Math.floor((disposedAt - new Date(gen).getTime()) / (1000 * 60 * 60 * 24)));

  const body = batchEntries.map((e, i) => {
    const wt = WASTE_TYPES.find((w) => w.id === e.waste_type_id);
    const code = wt?.statutoryCode ? ` (${wt.statutoryCode})` : "";
    return [
      String(i + 1),
      formatDateDDMMYYYY(e.generated_date),
      e.location ?? "—",
      `${wasteName(e.waste_type_id)}${code}`,
      e.waste_category === "hazardous" ? "HAZ" : e.waste_category === "non_hazardous" ? "NON-HAZ" : "OTHER",
      `${fmtNum(Number(e.weight_kg ?? 0))} ${wasteUnitLabel(e.waste_type_id)}`,
      e.piece_count != null ? String(e.piece_count) : "—",
      String(daysHeld(e.generated_date)),
      e.activity_type === "preventive" ? "PM" : e.activity_type === "breakdown" ? "BM" : e.activity_type === "5s" ? "5S" : "Others",
    ];
  });

  autoTable(doc, {
    startY: batch.notes ? 45 : 40,
    head: [["#", "Generated", "Location", "Waste Description & CPCB Code", "Cat", "Quantity", "Nos", "Days Held", "Source"]],
    body,
    styles: { fontSize: 7.5, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.1 },
    headStyles: { fillColor: [31, 107, 58], textColor: 255, fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      1: { cellWidth: 20 },
      2: { cellWidth: 22 },
      3: { cellWidth: 54 },
      4: { halign: "center", cellWidth: 16 },
      5: { halign: "right", cellWidth: 22 },
      6: { halign: "center", cellWidth: 10 },
      7: { halign: "center", cellWidth: 16 },
      8: { halign: "center", cellWidth: 12 },
    },
  });

  // Totals by waste type in weight
  const map = new Map<string, { kg: number; litres: number }>();
  batchEntries.forEach((e) => {
    const wt = WASTE_TYPES.find((w) => w.id === e.waste_type_id);
    const code = wt?.statutoryCode ? ` (${wt.statutoryCode})` : "";
    const k = `${wasteName(e.waste_type_id)}${code}`;
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
    startY: y1 + 5,
    head: [["Consolidated Waste Classification", "Dispatched Quantity"]],
    body: totalsBody,
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: { fillColor: [50, 60, 55], textColor: 255, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right", cellWidth: 40 } },
    margin: { left: 10, right: 10 },
  });

  const y2 = (doc as any).lastAutoTable?.finalY ?? y1 + 35;
  const ph = doc.internal.pageSize.getHeight();
  const sigY = Math.min(y2 + 14, ph - 30);
  doc.setFontSize(8);
  doc.text("1. Generator Authorised Signatory: ________________________", 10, sigY);
  doc.text("2. Transporter Vehicle & Driver Sign: ________________________", 10, sigY + 6);
  doc.text("3. TSDF Receiver Signatory: ________________________", 10, sigY + 12);
  doc.text("Vehicle No.: ____________________", pageW - 75, sigY);
  doc.text("TSDF Permit No.: ____________________", pageW - 75, sigY + 6);
  doc.text("Delivery Date: ____________________", pageW - 75, sigY + 12);

  doc.setFontSize(6.5).setTextColor(110);
  doc.text(
    "Form 10 Manifest 7-Copies: Copy 1 (White) Generator | Copy 2 (Yellow) Transporter | Copy 3 (Pink) TSDF | Copy 4 (Orange) SPCB | Copy 5 (Green) SPCB-Rx | Copy 6 (Blue) Gen-Ack | Copy 7 (Grey) Final SPCB",
    pageW / 2, ph - 9, { align: "center" }
  );
  doc.text("Generated by WasteBuddy Enterprise Portal — Statutory EHS Compliance Suite", pageW / 2, ph - 5, { align: "center" });

  doc.save(`Form10_Manifest_${safeName(siteName)}_${batch.disposed_date}.pdf`);
}

/**
 * Export official Form 8 Hazardous Waste Container Labels (Rule 17, HOWM Rules 2016).
 * Standardized 100mm x 100mm yellow label with bold red border.
 */
export function exportForm8ContainerLabelsPdf(
  entries: WasteEntry[],
  siteName: string,
) {
  if (entries.length === 0) return;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // 2 labels per A4 page (top and bottom)
  const labelW = 150;
  const labelH = 120;
  const leftMargin = (pageW - labelW) / 2;

  entries.forEach((entry, idx) => {
    const isSecondOnPage = idx % 2 === 1;
    if (idx > 0 && idx % 2 === 0) {
      doc.addPage();
    }

    const topMargin = isSecondOnPage ? 150 : 20;

    // Yellow background
    doc.setFillColor(254, 240, 138); // Yellow-200
    doc.rect(leftMargin, topMargin, labelW, labelH, "F");

    // Red thick border
    doc.setDrawColor(220, 38, 38); // Red-600
    doc.setLineWidth(1.8);
    doc.rect(leftMargin, topMargin, labelW, labelH, "D");

    // Inner thin border
    doc.setLineWidth(0.4);
    doc.rect(leftMargin + 2, topMargin + 2, labelW - 4, labelH - 4, "D");

    // Label Header
    doc.setFillColor(220, 38, 38);
    doc.rect(leftMargin + 2, topMargin + 2, labelW - 4, 14, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold").setFontSize(13);
    doc.text("HAZARDOUS WASTE", pageW / 2, topMargin + 9, { align: "center" });
    doc.setFontSize(7).setFont("helvetica", "normal");
    doc.text("FORM 8 — [See Rule 17(1) of HOWM Rules 2016]", pageW / 2, topMargin + 13.5, { align: "center" });

    // Label Details
    doc.setTextColor(20, 20, 20);
    const wt = WASTE_TYPES.find((w) => w.id === entry.waste_type_id);
    const wName = wt?.name ?? entry.waste_type_id;
    const cat = entry.waste_category === "hazardous" ? "Hazardous Waste" : "Regulated Waste";
    const physicalForm = wt?.category ?? "Solid / Liquid";
    const statCode = (wt as any)?.statutoryCode || "Schedule I - HOWM";
    const qty = `${fmtNum(Number(entry.weight_kg ?? 0))} ${unitLabel(getMeasureUnit(entry.waste_type_id))}`;

    let y = topMargin + 22;
    const addRow = (label: string, val: string) => {
      doc.setFont("helvetica", "bold").setFontSize(8.5);
      doc.text(label, leftMargin + 6, y);
      doc.setFont("helvetica", "normal").setFontSize(8.5);
      doc.text(val, leftMargin + 48, y);
      y += 7.5;
    };

    addRow("Waste Description:", wName);
    addRow("Regulatory Stream:", `${cat} (${statCode})`);
    addRow("Physical State:", physicalForm);
    addRow("Total Quantity / Net:", qty);
    addRow("Generation Date:", formatDateDDMMYYYY(entry.generated_date));
    addRow("Occupier / Facility:", siteName);
    addRow("Origin Location:", entry.location || "Facility Yard");
    addRow("In Emergency Contact:", "Plant EHS / Site In-charge");

    // Danger warning footer
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.5);
    doc.line(leftMargin + 4, topMargin + 94, leftMargin + labelW - 4, topMargin + 94);

    doc.setTextColor(185, 28, 28);
    doc.setFont("helvetica", "bold").setFontSize(7.5);
    doc.text(
      "HANDLE WITH CARE · DO NOT INHALE OR INGEST · KEEP AWAY FROM HEAT",
      pageW / 2,
      topMargin + 100,
      { align: "center" },
    );
    doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(80, 80, 80);
    doc.text(
      "In case of spillage, contain with dry sand/earth. Consult Material Safety Data Sheet (MSDS).",
      pageW / 2,
      topMargin + 104,
      { align: "center" },
    );

    // Label Barcode string
    doc.setFont("courier", "bold").setFontSize(7).setTextColor(40, 40, 40);
    doc.text(`UID: ${entry.id.slice(0, 18).toUpperCase()}`, pageW / 2, topMargin + 112, { align: "center" });
  });

  const date = new Date().toISOString().split("T")[0];
  doc.save(`Form8_Labels_${safeName(siteName)}_${date}.pdf`);
}

/**
 * Export official Form 4 Annual Return for Hazardous and Other Wastes.
 * Mandated under Rule 20(2) of HOWM Rules 2016 for submission to SPCB by June 30.
 */
export function exportForm4AnnualReturnPdf(
  entries: WasteEntry[],
  batches: DisposalBatch[],
  siteName: string,
  financialYear: number,
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const fyLabel = `FY ${financialYear}-${String(financialYear + 1).slice(-2)}`;
  const fyStart = new Date(`${financialYear}-04-01T00:00:00`).getTime();
  const fyEnd = new Date(`${financialYear + 1}-03-31T23:59:59`).getTime();

  const batchMap = new Map<string, string>();
  batches.forEach((b) => batchMap.set(b.id, b.disposed_date));

  // Title & Header
  doc.setFontSize(13).setFont("helvetica", "bold");
  doc.text("FORM 4", pageW / 2, 12, { align: "center" });
  doc.setFontSize(10).setFont("helvetica", "bold");
  doc.text("ANNUAL RETURN FOR HAZARDOUS & OTHER WASTES", pageW / 2, 17, { align: "center" });
  doc.setFontSize(7.5).setFont("helvetica", "normal");
  doc.text(
    "[See Rules 6(5), 13(8), 16(6) and 20(2) of Hazardous and Other Wastes (Management & Transboundary Movement) Rules, 2016]",
    pageW / 2, 21.5, { align: "center" }
  );

  // Metadata block
  doc.setFontSize(8);
  doc.text(`1. Name and address of facility: ${siteName}`, 14, 29);
  doc.text(`2. Financial Year: ${fyLabel} (01-Apr-${financialYear} to 31-Mar-${financialYear + 1})`, 14, 34);
  doc.text(`3. SPCB Authorization / Registration No.: SPCB/HOWM/${safeName(siteName)}/REG`, pageW - 14, 29, { align: "right" });
  doc.text(`4. Date of Submission: ${new Date().toLocaleDateString("en-IN")}`, pageW - 14, 34, { align: "right" });

  // Calculation per waste type
  const tableData: any[] = [];
  let totalOpenKg = 0, totalGenKg = 0, totalDispKg = 0, totalCloseKg = 0;
  let totalOpenL = 0, totalGenL = 0, totalDispL = 0, totalCloseL = 0;

  WASTE_TYPES.forEach((wt) => {
    const matching = entries.filter((e) => e.waste_type_id === wt.id);
    if (matching.length === 0) return;

    let opening = 0;
    let generated = 0;
    let disposed = 0;

    matching.forEach((e) => {
      const genTime = new Date(e.generated_date + "T00:00:00").getTime();
      const dispDateStr = e.disposal_batch_id ? batchMap.get(e.disposal_batch_id) : null;
      const dispTime = dispDateStr ? new Date(dispDateStr + "T00:00:00").getTime() : null;
      const w = Number(e.weight_kg ?? 0);

      // Opening stock: generated before FY start and not disposed before FY start
      if (genTime < fyStart) {
        if (!dispTime || dispTime >= fyStart) {
          opening += w;
        }
      }

      // Generated during FY
      if (genTime >= fyStart && genTime <= fyEnd) {
        generated += w;
      }

      // Disposed during FY
      if (dispTime && dispTime >= fyStart && dispTime <= fyEnd) {
        disposed += w;
      }
    });

    const closing = Math.max(0, opening + generated - disposed);

    if (opening > 0 || generated > 0 || disposed > 0 || closing > 0) {
      const u = wt.measureUnit === "litres" ? "L" : "kg";
      tableData.push([
        tableData.length + 1,
        wt.name,
        wt.statutoryCode || "—",
        wt.category,
        wt.wasteCategory === "hazardous" ? "Hazardous" : wt.wasteCategory === "e_waste" ? "E-Waste" : "Other",
        `${fmtNum(opening)} ${u}`,
        `${fmtNum(generated)} ${u}`,
        `${fmtNum(disposed)} ${u}`,
        `${fmtNum(closing)} ${u}`,
        disposed > 0 ? "Authorized TSDF / Recycler" : "—",
      ]);

      if (u === "kg") {
        totalOpenKg += opening;
        totalGenKg += generated;
        totalDispKg += disposed;
        totalCloseKg += closing;
      } else {
        totalOpenL += opening;
        totalGenL += generated;
        totalDispL += disposed;
        totalCloseL += closing;
      }
    }
  });

  autoTable(doc, {
    startY: 38,
    head: [[
      "#",
      "Waste Description",
      "CPCB Code",
      "Physical Form",
      "Category",
      "Opening Stock (01-Apr)",
      "Generation in FY",
      "Dispatched / Disposed",
      "Closing Stock (31-Mar)",
      "Disposal Facility Mode",
    ]],
    body: tableData.length > 0 ? tableData : [["—", "No activity recorded for this financial year", "—", "—", "—", "—", "—", "—", "—", "—"]],
    styles: { fontSize: 7.5, cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.1 },
    headStyles: { fillColor: [31, 107, 58], textColor: 255, fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      1: { cellWidth: 46 },
      2: { cellWidth: 24 },
      3: { cellWidth: 20 },
      4: { halign: "center", cellWidth: 20 },
      5: { halign: "right", cellWidth: 26 },
      6: { halign: "right", cellWidth: 26 },
      7: { halign: "right", cellWidth: 26 },
      8: { halign: "right", cellWidth: 26 },
      9: { cellWidth: 46 },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? 130;
  const sigY = Math.min(finalY + 12, pageH - 28);

  doc.setFontSize(8).setFont("helvetica", "bold");
  doc.text("Statutory FY Totals:", 14, sigY);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Solids: Opening ${fmtNum(totalOpenKg)} kg  |  Generated ${fmtNum(totalGenKg)} kg  |  Disposed ${fmtNum(totalDispKg)} kg  |  Closing ${fmtNum(totalCloseKg)} kg`,
    14, sigY + 4
  );
  if (totalGenL > 0 || totalOpenL > 0) {
    doc.text(
      `Liquids: Opening ${fmtNum(totalOpenL)} L  |  Generated ${fmtNum(totalGenL)} L  |  Disposed ${fmtNum(totalDispL)} L  |  Closing ${fmtNum(totalCloseL)} L`,
      14, sigY + 8
    );
  }

  doc.text("Declaration: I hereby declare that the particulars given above are true and correct to the best of my knowledge.", 14, sigY + 14);
  doc.text("Date: ________________________", 14, sigY + 19);
  doc.text("Authorized Signatory (Occupier / Manager): ____________________________", pageW - 14, sigY + 19, { align: "right" });

  doc.setFontSize(6.5).setTextColor(120);
  doc.text("WasteBuddy Enterprise EHS Portal · Generated under Rule 20(2) of HOWM Rules, 2016", pageW / 2, pageH - 5, { align: "center" });

  doc.save(`Form4_AnnualReturn_${safeName(siteName)}_${financialYear}_${financialYear + 1}.pdf`);
}

