import { NextResponse } from 'next/server';
import { getFirestore } from '@/lib/server/firebase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const firestore = getFirestore();
    const snapshot = await firestore.doc('settings/silakar_settings').get();
    const url = snapshot.exists ? String(snapshot.data()?.whatsappGroupUrl || '') : '';
    return NextResponse.json({ success: true, url });
  } catch {
    return NextResponse.json({ success: true, url: '' });
  }
}
