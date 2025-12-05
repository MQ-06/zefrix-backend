// api/_firebase.js
import admin from "firebase-admin";

let privateKey = process.env.FIREBASE_PRIVATE_KEY;

// Fix private key formatting (Vercel sometimes escapes \n)
if (privateKey) {
  // Handle both escaped and unescaped newlines
  if (privateKey.includes("\\n")) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }
  // Remove quotes if present
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }
  // Ensure proper newline format
  privateKey = privateKey.replace(/\\n/g, "\n");
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

// Validate required environment variables
if (!projectId || !clientEmail || !privateKey) {
  const missing = [];
  if (!projectId) missing.push("FIREBASE_PROJECT_ID");
  if (!clientEmail) missing.push("FIREBASE_CLIENT_EMAIL");
  if (!privateKey) missing.push("FIREBASE_PRIVATE_KEY");
  console.error(`Missing Firebase environment variables: ${missing.join(", ")}`);
}

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        project_id: projectId,
        client_email: clientEmail,
        private_key: privateKey,
      }),
    });
    console.log("Firebase Admin initialized successfully");
  } catch (error) {
    console.error("Firebase initialization error:", error.message);
    throw new Error(`Firebase initialization failed: ${error.message}`);
  }
}

export const db = admin.firestore();
export const auth = admin.auth();
export const adminLib = admin;
