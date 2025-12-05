// api/admin-classes.js - Get all classes with optional filters
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

    const { status, limit = 100 } = req.query;
    
    let query = db.collection("classes");
    
    // Filter by approval status if provided
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      query = query.where("approvalStatus", "==", status);
    }

    const snapshot = await query.get();
    let classes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Sort by createdAt in memory (newest first)
    classes.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt?._seconds || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?._seconds || 0;
      return bTime - aTime;
    });
    
    // Apply limit after sorting
    classes = classes.slice(0, parseInt(limit));

    return res.status(200).json({ success: true, classes, count: classes.length });
  } catch (err) {
    console.error("admin-classes error:", err);
    if (err.code === "not-authorized" || err.code === "no-token") {
      return res.status(403).json({ error: "Not authorized" });
    }
    return res.status(500).json({ error: err.message });
  }
}

