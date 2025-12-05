// api/_firebase.js
import admin from "firebase-admin";

let privateKey = process.env.FIREBASE_PRIVATE_KEY;

// Fix private key formatting (Vercel sometimes escapes \n)
if (privateKey && privateKey.includes("\\n")) {
  privateKey = privateKey.replace(/\\n/g, "\n");
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      project_id: projectId,
      client_email: clientEmail,
      private_key: privateKey,
    }),
  });
}

export const db = admin.firestore();
export const auth = admin.auth();
export const adminLib = admin;
