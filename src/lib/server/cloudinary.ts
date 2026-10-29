import { v2 as cloudinary } from 'cloudinary';
cloudinary.config({cloud_name:process.env.CLOUDINARY_CLOUD_NAME,api_key:process.env.CLOUDINARY_API_KEY,api_secret:process.env.CLOUDINARY_API_SECRET});
export async function uploadDraftPhoto(dataUrl:string, scope:string, draftId:string, index:number) { const r=await cloudinary.uploader.upload(dataUrl,{folder:`silakar/draft/${scope}/${draftId}`,public_id:`foto-${index}`,resource_type:'image',tags:['silakar','draft']}); return {publicId:r.public_id,url:r.secure_url}; }
export async function deleteDraftPhoto(publicId:string) { try { await cloudinary.uploader.destroy(publicId); } catch {} }
