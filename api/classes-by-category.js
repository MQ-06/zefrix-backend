// api/classes-by-category.js - Get classes filtered by category
import { db } from "./_firebase.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { category, subCategory, status = "approved" } = req.query;

    if (!category) {
      return res.status(400).json({ error: "category query parameter required" });
    }

    let query = db.collection("classes")
      .where("category", "==", category)
      .where("approvalStatus", "==", status);

    const snapshot = await query.get();
    let classes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Filter by subCategory if provided (client-side since we can't have multiple where clauses)
    if (subCategory) {
      classes = classes.filter(c => c.subCategory === subCategory);
    }

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
      category,
      subCategory: subCategory || null,
    });
  } catch (err) {
    console.error("classes-by-category error:", err);
    return res.status(500).json({ error: err.message });
  }
}

