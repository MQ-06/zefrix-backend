// api/pending-classes.js
import { db } from "./_firebase.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(200).json({ success: true, classes: [] });

  try {
    const snapshot = await db.collection("classes")
      .where("approvalStatus", "==", "pending")
      .get();

    const classes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Sort by createdAt in memory (newest first)
    classes.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt?._seconds || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?._seconds || 0;
      return bTime - aTime;
    });
    
    return res.status(200).json({ success: true, classes });
  } catch (err) {
    console.error("pending-classes error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
