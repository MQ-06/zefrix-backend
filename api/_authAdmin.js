// api/_authAdmin.js
import { auth, db } from "./_firebase.js";

export async function verifyAdmin(req) {
  const header = req.headers.authorization || "";
  const token = header.split("Bearer ")[1] || header.split("bearer ")[1] || null;
  if (!token) {
    const err = new Error("Missing Authorization token");
    err.code = "no-token";
    throw err;
  }

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
}
