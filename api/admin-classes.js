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
    
    // Order by creation date (newest first)
    query = query.orderBy("createdAt", "desc").limit(parseInt(limit));

    const snapshot = await query.get();
    const classes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return res.status(200).json({ success: true, classes, count: classes.length });
  } catch (err) {
    console.error("admin-classes error:", err);
    if (err.code === "not-authorized" || err.code === "no-token") {
      return res.status(403).json({ error: "Not authorized" });
    }
    return res.status(500).json({ error: err.message });
  }
}

