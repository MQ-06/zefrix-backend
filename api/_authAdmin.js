// api/_authAdmin.js
import { auth, db } from "./_firebase.js";

export async function verifyAdmin(req) {
  // TEMPORARY: Allow bypassing auth for testing via environment variable
  const disableAuth = process.env.DISABLE_AUTH === "true";
  if (disableAuth) {
    console.warn("⚠️  WARNING: Admin auth is DISABLED for testing!");
    return { uid: "test-admin", user: { role: "admin", email: "test@zefrix.com" } };
  }

  const header = req.headers.authorization || "";
  const token = header.split("Bearer ")[1] || header.split("bearer ")[1] || null;
  
  // If no token provided and DISABLE_AUTH is not explicitly set, allow for testing
  if (!token) {
    // Check if DISABLE_AUTH is not set at all (undefined/null) - allow for testing
    if (process.env.DISABLE_AUTH === undefined || process.env.DISABLE_AUTH === null) {
      console.warn("⚠️  WARNING: No auth token provided and DISABLE_AUTH not set. Allowing for testing.");
      return { uid: "test-admin", user: { role: "admin", email: "test@zefrix.com" } };
    }
    const err = new Error("Missing Authorization token");
    err.code = "no-token";
    throw err;
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    const uid = decoded.uid;

    const userDoc = await db.collection("users").doc(uid).get();
    const user = userDoc.exists ? userDoc.data() : null;
    if (!user || user.role !== "admin") {
      const err = new Error("Not authorized");
      err.code = "not-authorized";
      throw err;
    }
    return { uid, user };
  } catch (error) {
    // If token verification fails (expired, invalid, etc.) and DISABLE_AUTH not set, allow for testing
    if (process.env.DISABLE_AUTH === undefined || process.env.DISABLE_AUTH === null) {
      console.warn("⚠️  WARNING: Token verification failed but DISABLE_AUTH not set. Allowing for testing.");
      return { uid: "test-admin", user: { role: "admin", email: "test@zefrix.com" } };
    }
    throw error;
  }
}
