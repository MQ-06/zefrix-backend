// api/admin-enrollments.js - Get all enrollments
import { db } from "./_firebase.js";
import { verifyAdmin } from "./_authAdmin.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    await verifyAdmin(req);

    const { classId, limit = 100 } = req.query;
    
    let query = db.collection("enrollments");
    
    // Filter by classId if provided
    if (classId) {
      query = query.where("classId", "==", classId);
    }
    
    query = query.orderBy("createdAt", "desc").limit(parseInt(limit));

    const snapshot = await query.get();
    const enrollments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return res.status(200).json({ success: true, enrollments, count: enrollments.length });
  } catch (err) {
    console.error("admin-enrollments error:", err);
    if (err.code === "not-authorized" || err.code === "no-token") {
      return res.status(403).json({ error: "Not authorized" });
    }
    return res.status(500).json({ error: err.message });
  }
}

