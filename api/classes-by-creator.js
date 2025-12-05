// api/classes-by-creator.js - Get classes by specific creator
import { db } from "./_firebase.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { creatorUid, status = "approved" } = req.query;

    if (!creatorUid) {
      return res.status(400).json({ error: "creatorUid query parameter required" });
    }

    const snapshot = await db.collection("classes")
      .where("creatorUid", "==", creatorUid)
      .where("approvalStatus", "==", status)
      .get();

    let classes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Filter out past classes (only show upcoming)
    const now = new Date();
    classes = classes.filter(c => {
      const startTime = c.startTime?.toDate?.() || new Date(c.startTime);
      return startTime > now;
    });

    // Sort by startTime (upcoming first)
    classes.sort((a, b) => {
      const aTime = a.startTime?.toDate?.() || new Date(a.startTime);
      const bTime = b.startTime?.toDate?.() || new Date(b.startTime);
      return aTime - bTime;
    });

    return res.status(200).json({
      success: true,
      classes,
      count: classes.length,
      creatorUid,
    });
  } catch (err) {
    console.error("classes-by-creator error:", err);
    return res.status(500).json({ error: err.message });
  }
}

