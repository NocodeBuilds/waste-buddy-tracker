import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { entrySchema, validatePhotos } from "@/lib/validation";
import { csvCell } from "@/lib/csv";
import { readAll } from "@/lib/pagination";
import { isDisposed, isEntryOverdue, getStatus, WasteEntry } from "@/lib/wasteTypes";
import { clearPendingQueue, getPendingQueue, saveToPendingQueue, uploadPendingEntry, PendingEntry } from "@/lib/offlineSync";

const mocks=vi.hoisted(()=>({getUser:vi.fn(),from:vi.fn(),upload:vi.fn(),signed:vi.fn()}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{
 auth:{getUser:mocks.getUser},from:mocks.from,
 storage:{from:()=>({upload:mocks.upload,createSignedUrl:mocks.signed})},
}}));
const data={waste_type_id:"oil-cotton",waste_category:"hazardous" as const,weight_kg:25,
 generated_date:"2025-01-01",activity_type:"preventive" as const};
const draft=():PendingEntry=>({tempId:crypto.randomUUID(),siteId:"site-a",userId:"owner-a",timestamp:Date.now(),data:{...data}});
beforeEach(async()=>{vi.clearAllMocks();localStorage.clear();await clearPendingQueue();mocks.getUser.mockResolvedValue({data:{user:{id:"owner-a"}},error:null});});

describe("Input and export boundaries",()=>{
 it.each([NaN,Infinity,-Infinity,0,-1,1e10])("rejects invalid measurement %s",weight=>{
  expect(entrySchema.safeParse({...data,weight_kg:weight}).success).toBe(false);
 });
 it.each(["2025-02-30","2099-01-01","not-a-date"])("rejects invalid/future date %s",date=>{
  expect(entrySchema.safeParse({...data,generated_date:date}).success).toBe(false);
 });
 it("rejects mismatched category, fractional count and oversized notes",()=>{
  for(const update of [{waste_category:"e_waste"},{piece_count:1.5},{notes:"x".repeat(5001)}])
   expect(entrySchema.safeParse({...data,...update}).success).toBe(false);
 });
 it("does not silently strip quotes, commas or newlines from CSV values",()=>{
  expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
 });
 it.each(["=1+1"," +SUM(A1:A2)","\t@SUM(1)","\n-cmd"," @evil"])("neutralizes formula prefix %s",value=>{
  expect(csvCell(value).startsWith('"\'')).toBe(true);
 });
 it("blocks SVG uploads and too many photos before any save",()=>{
  expect(()=>validatePhotos([new File(["<svg/>"],"x.svg",{type:"image/svg+xml"})])).toThrow();
  expect(()=>validatePhotos(Array.from({length:11},()=>new File(["a"],"x.jpg",{type:"image/jpeg"})))).toThrow();
 });
 it("fetches beyond a server-imposed page cap",async()=>{
  const records=Array.from({length:7},(_,i)=>i);
  const fetch=vi.fn(async(offset:number)=>({data:records.slice(offset,offset+2),error:null}));
  expect(await readAll(fetch)).toEqual(records);
  expect(fetch).toHaveBeenCalledTimes(5);
 });
 it("propagates a failed page instead of returning a partial export",async()=>{
  const fetch=vi.fn().mockResolvedValueOnce({data:[1,2],error:null}).mockResolvedValueOnce({data:null,error:{message:"Forbidden"}});
  await expect(readAll(fetch)).rejects.toThrow("Forbidden");
 });
});
describe("Disposal accounting",()=>{
 const entry:WasteEntry={...data,id:"e",site_id:"s",disposal_batch_id:"b",disposal_status:"pending"};
 it("keeps pending and rejected requests in storage alerts",()=>{
  expect(isDisposed(entry)).toBe(false);expect(isEntryOverdue(entry)).toBe(true);expect(getStatus(entry)).toBe("overdue");
  expect(isDisposed({...entry,disposal_status:"rejected"})).toBe(false);
 });
 it("preserves completed historical records and approved disposals",()=>{
  expect(isDisposed({...entry,disposal_status:"approved"})).toBe(true);
  expect(isDisposed({...entry,disposal_status:undefined})).toBe(true);
 });
});
describe("Durable outbox and replay protection",()=>{
 it("does not lose concurrent saves or expose another owner's drafts",async()=>{
  const a=draft(),b={...draft(),userId:"owner-b"};
  await Promise.all([saveToPendingQueue(a),saveToPendingQueue(b)]);
  expect((await getPendingQueue()).length).toBe(2);
  expect((await getPendingQueue("owner-a")).map(e=>e.tempId)).toEqual([a.tempId]);
 });
 it("updates an existing operation instead of duplicating it",async()=>{
  const a=draft();await saveToPendingQueue(a);await saveToPendingQueue({...a,error:"retry"});
  expect((await getPendingQueue()).length).toBe(1);
 });
 it("never sends another user's draft, including on retries",async()=>{
  const a={...draft(),userId:"owner-b"};await saveToPendingQueue(a);
  await expect(uploadPendingEntry(a)).rejects.toThrow("entry owner");
  expect(mocks.from).not.toHaveBeenCalled();expect((await getPendingQueue()).length).toBe(1);
 });
 it("retains the draft after a lost response and reuses its primary key",async()=>{
  const a=draft();await saveToPendingQueue(a);
  const insert=vi.fn().mockResolvedValueOnce({error:{code:"NETWORK",message:"Connection lost"}}).mockResolvedValueOnce({error:{code:"23505"}});
  const single=vi.fn().mockResolvedValue({data:{...a.data,id:a.tempId,site_id:a.siteId,created_by:a.userId},error:null});
  mocks.from.mockReturnValue({insert,select:()=>({eq:()=>({single})})});
  await expect(uploadPendingEntry(a)).rejects.toThrow("Connection lost");
  expect((await getPendingQueue()).length).toBe(1);
  await uploadPendingEntry(a);
  expect(insert.mock.calls.map(call=>call[0].id)).toEqual([a.tempId,a.tempId]);
  expect((await getPendingQueue()).length).toBe(0);
 });
 it("does not treat an unrelated primary-key collision as success",async()=>{
  const a=draft();await saveToPendingQueue(a);
  mocks.from.mockReturnValue({insert:async()=>({error:{code:"23505"}}),select:()=>({eq:()=>({single:async()=>({data:{...a.data,site_id:"different",created_by:a.userId},error:null})})})});
  await expect(uploadPendingEntry(a)).rejects.toThrow("verify");expect((await getPendingQueue()).length).toBe(1);
 });
 it("preserves a draft when a photo upload fails after the row is committed",async()=>{
  const a={...draft(),photos:[{id:crypto.randomUUID(),file:new Blob(["photo"],{type:"image/jpeg"}),path:"site-a/entry/photo"}]};
  await saveToPendingQueue(a);mocks.from.mockReturnValue({insert:async()=>({error:null}),select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})})});
  mocks.upload.mockResolvedValue({error:{message:"Storage unavailable",statusCode:503}});
  await expect(uploadPendingEntry(a)).rejects.toThrow("Storage unavailable");expect((await getPendingQueue()).length).toBe(1);
 });
});
