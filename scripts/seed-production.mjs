import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';

// Load local .env without exposing values to logs. Deployment environments already
// provide process.env and take precedence.
try {
  const envText = fs.readFileSync(new URL('../.env', import.meta.url), 'utf8');
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
} catch {}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} belum diisi.`);
  return value;
}

const raw = required('FIREBASE_SERVICE_ACCOUNT');
let serviceAccount;
try {
  serviceAccount = JSON.parse(raw);
} catch {
  throw new Error('FIREBASE_SERVICE_ACCOUNT harus berupa JSON valid.');
}

const app = getApps()[0] || initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

const username = (process.env.SEED_ADMIN_USERNAME || 'admin').trim().toLowerCase();
const password = required('SEED_ADMIN_PASSWORD');
const namaLengkap = (process.env.SEED_ADMIN_NAME || 'Administrator SILAKAR').trim();
const whatsappGroupUrl = (process.env.SEED_WHATSAPP_GROUP_URL || '').trim();

if (!/^[a-z0-9._-]{3,50}$/.test(username)) {
  throw new Error('SEED_ADMIN_USERNAME hanya boleh berisi huruf kecil, angka, titik, underscore, atau strip.');
}
if (password.length < 1) throw new Error('SEED_ADMIN_PASSWORD wajib diisi.');

const userRef = db.collection('users').doc(username);
const userSnap = await userRef.get();
if (!userSnap.exists) {
  await userRef.set({
    username,
    password: bcrypt.hashSync(password, 12),
    role: 'admin',
    namaLengkap,
    permissions: {},
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log(`Akun admin '${username}' berhasil dibuat.`);
} else {
  console.log(`Akun '${username}' sudah ada; tidak diubah.`);
}

const settingsRef = db.collection('settings').doc('silakar_settings');
const settings = {
  updatedAt: FieldValue.serverTimestamp(),
  appName: 'SILAKAR',
};
if (whatsappGroupUrl) settings.whatsappGroupUrl = whatsappGroupUrl;
await settingsRef.set(settings, { merge: true });

console.log('Dokumen settings/silakar_settings berhasil disiapkan.');
console.log('Provisioning selesai. Hapus variable SEED_ADMIN_PASSWORD setelah selesai.');
