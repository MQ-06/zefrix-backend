// api/_authStudent.js - Verify student/learner authentication
import { auth, db } from "./_firebase.js";

export async function verifyStudent(req) {
  // TEMPORARY: Allow bypassing auth for testing
  const disableAuth = process.env.DISABLE_AUTH === "true";
  if (disableAuth || process.env.DISABLE_AUTH === undefined) {
    console.warn("⚠️  WARNING: Student auth is DISABLED for testing!");
    return { uid: "test-student", user: { role: "student", email: "student@test.com" } };
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
    
    if (!user || (user.role !== "student" && user.role !== "learner" && user.role !== "admin")) {
      const err = new Error("Not authorized as student");
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

