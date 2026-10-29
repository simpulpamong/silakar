import { getFirestore } from './firebase';
import { uploadDraftPhoto, deleteDraftPhoto } from './cloudinary';
export interface DraftPhotoMeta { hasGps?: boolean; lat?: number|null; lng?: number|null; datetime?: string|null; address?: string|null; source?: string }
type Photo = { publicId:string; dataUrl?:string; mime:string; source:string; exifMeta:DraftPhotoMeta; sizeKB:number; url?:string }
type Draft = { draftId:string; scope:string; teks:string; label:string; photos:Photo[]; createdAt:number }
const memory = new Map<string,Draft>();
const firebase = () => Boolean(process.env.FIREBASE_SERVICE_ACCOUNT && process.env.CLOUDINARY_CLOUD_NAME);
const col = () => getFirestore().collection('silakar-drafts');
export async function createDraft(x:{draftId:string;scope:string;teks:string;label:string}) { const d={...x,photos:[],createdAt:Date.now()}; if(firebase()) await col().doc(x.draftId).set(d); else memory.set(x.draftId,d); return x.draftId; }
export async function appendDraftPhoto(x:{draftId:string;scope:string;dataUrl:string;mime:string;source:string;sizeKB:number;exifMeta:DraftPhotoMeta}) { const d=await read(x.draftId); if(!d) throw new Error('Draft tidak ditemukan'); const uploaded=await uploadDraftPhoto(x.dataUrl,x.scope,x.draftId,d.photos.length+1); const photo={publicId:uploaded.publicId,url:uploaded.url,mime:x.mime,source:x.source,sizeKB:x.sizeKB,exifMeta:x.exifMeta}; d.photos.push(photo); await save(d); return {publicId:photo.publicId}; }
export async function consumeDraft(id:string) { const d=await read(id); if(!d) throw new Error('Draft tidak ditemukan'); if(firebase()) await col().doc(id).delete(); else memory.delete(id); return {teks:d.teks,photos:d.photos,summary:{teksPreview:d.label||d.teks.slice(0,120)}}; }
export async function getDraft(id:string) { const d=await read(id); return {exists:!!d,jumlahFoto:d?.photos.length||0}; }
export async function deleteDraft(id:string) { const d=await read(id); if(!d)return false; for(const p of d.photos) await deleteDraftPhoto(p.publicId); if(firebase()) await col().doc(id).delete(); else memory.delete(id); return true; }
export async function listDrafts(scope:string) { if(firebase()){ const s=await col().where('scope','==',scope).get(); return s.docs.map(x=>{const d=x.data() as Draft; return {draftId:d.draftId,scope:d.scope,teksPreview:d.label||d.teks.slice(0,120),jumlahFoto:d.photos.length,createdAt:d.createdAt}; }); } return [...memory.values()].filter(d=>d.scope===scope).map(d=>({draftId:d.draftId,scope:d.scope,teksPreview:d.label||d.teks.slice(0,120),jumlahFoto:d.photos.length,createdAt:d.createdAt})); }
async function read(id:string){ return firebase()?((await col().doc(id).get()).data() as Draft|undefined):memory.get(id); }
async function save(d:Draft){ if(firebase()) await col().doc(d.draftId).set(d); else memory.set(d.draftId,d); }
