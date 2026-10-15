import { validatePhotos } from "./validation";
const MAX_DIMENSION=1200;
export async function compressImage(file:File):Promise<File>{
 validatePhotos([file]);
 let bitmap:ImageBitmap;
 try { bitmap=await createImageBitmap(file); }
 catch {
  // HEIC is accepted by storage even on devices without a browser decoder.
  if(["image/heic","image/heif"].includes(file.type)) return file;
  throw new Error("This photo cannot be decoded. Choose a valid JPEG, PNG or WebP image.");
 }
 try {
  if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>100_000_000) throw new Error("Photo dimensions are too large");
  const ratio=Math.min(1,MAX_DIMENSION/bitmap.width,MAX_DIMENSION/bitmap.height);
  const canvas=document.createElement("canvas");
  canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
  const ctx=canvas.getContext("2d");
  if(!ctx) throw new Error("Photo processing is unavailable");
  ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Photo encoding failed")),"image/jpeg",0.7));
  return new File([blob],file.name.replace(/\.[^.]+$/,"")+".jpg",{type:"image/jpeg"});
 } finally {bitmap.close();}
}
export async function compressImages(files:File[]):Promise<File[]>{
 validatePhotos(files);const output:File[]=[];
 // Sequential decoding bounds memory on mobile devices.
 for(const file of files) output.push(await compressImage(file));
 return output;
}
