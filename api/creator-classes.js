// api/creator-classes.js - Get creator's classes
import { db } from "./_firebase.js";
import { verifyCreator } from "./_authCreator.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { uid } = await verifyCreator(req);
    const { status, type } = req.query; // Optional filters

    let query = db.collection("classes").where("creatorUid", "==", uid);

    // Filter by approval status if provided
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      query = query.where("approvalStatus", "==", status);
    }

    const snapshot = await query.get();
    let classes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Filter by type if provided (client-side since we can't have multiple where clauses)
    if (type && (type === "one-time" || type === "batch")) {
      classes = classes.filter(c => c.type === type);
    }

    // Sort by createdAt (newest first)
    classes.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt?._seconds || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?._seconds || 0;
      return bTime - aTime;
    });

    return res.status(200).json({ success: true, classes, count: classes.length });
  } catch (err) {
    console.error("creator-classes error:", err);
    if (err.code === "not-authorized" || err.code === "no-token") {
      return res.status(403).json({ error: "Not authorized" });
    }
    return res.status(500).json({ error: err.message });
  }
}

