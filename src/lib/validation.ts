import { z } from "zod";
import { WASTE_TYPES, getLocalDate } from "./wasteTypes";
export const entrySchema = z.object({
  waste_type_id: z.string().max(100),
  waste_category: z.enum(["hazardous", "non_hazardous", "e_waste", "other_wastes"]),
  weight_kg: z.number().finite().positive().max(1_000_000_000),
  piece_count: z.number().int().nonnegative().max(1_000_000_000).nullable().optional(),
  generated_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const parsed = new Date(value + "T12:00:00Z");
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value && value <= getLocalDate();
  }, "Enter a valid date that is not in the future"),
  activity_type: z.enum(["breakdown", "preventive", "5s", "others"]),
  location: z.string().max(500).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
}).superRefine((value, ctx) => {
  if (!WASTE_TYPES.some(type => type.id === value.waste_type_id && type.wasteCategory === value.waste_category)) {
    ctx.addIssue({ code: "custom", message: "Waste type and category do not match" });
  }
});
export function errorMessage(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message || "Invalid input";
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return "The operation failed. Please try again.";
}
export function validatePhotos(files: File[]) {
  if (files.length > 10) throw new Error("Attach at most 10 photos per entry");
  if (files.some(file => !["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(file.type))) throw new Error("Use JPEG, PNG, WebP or HEIC photos");
  if (files.some(file => file.size > 25 * 1024 * 1024) || files.reduce((sum, file) => sum + file.size, 0) > 50 * 1024 * 1024) throw new Error("Photos must be under 25 MB each and 50 MB in total");
}
