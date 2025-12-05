// api/_authCreator.js - Verify creator authentication
import { auth, db } from "./_firebase.js";

export async function verifyCreator(req) {
  // TEMPORARY: Allow bypassing auth for testing
  const disableAuth = process.env.DISABLE_AUTH === "true";
  if (disableAuth || process.env.DISABLE_AUTH === undefined) {
    console.warn("⚠️  WARNING: Creator auth is DISABLED for testing!");
    return { uid: "test-creator", user: { role: "creator", email: "creator@test.com" } };
  }

  const header = req.headers.authorization || "";
  const token = header.split("Bearer ")[1] || header.split("bearer ")[1] || null;
  
  if (!token) {
    const err = new Error("Missing Authorization token");
    err.code = "no-token";
    throw err;
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    const uid = decoded.uid;

    const userDoc = await db.collection("users").doc(uid).get();
    const user = userDoc.exists ? userDoc.data() : null;
    
    if (!user || (user.role !== "creator" && user.role !== "admin")) {
      const err = new Error("Not authorized as creator");
      err.code = "not-authorized";
      throw err;
    }
    
    return { uid, user };
  } catch (error) {
    if (error.code === "auth/id-token-expired") {
      const err = new Error("Token expired");
      err.code = "token-expired";
      throw err;
    }
    throw error;
  }
}

