// api/search-classes.js - Search classes by title, description, category
import { db } from "./_firebase.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { q, category, status = "approved" } = req.query;

    if (!q) {
      return res.status(400).json({ error: "q (query) parameter required" });
    }

    // Get all approved classes (Firestore doesn't support full-text search)
    let query = db.collection("classes").where("approvalStatus", "==", status);
    
    if (category) {
      query = query.where("category", "==", category);
    }

    const snapshot = await query.get();
    let classes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Client-side search (case-insensitive)
    const searchTerm = q.toLowerCase();
    classes = classes.filter(c => {
      const title = (c.title || "").toLowerCase();
      const description = (c.description || "").toLowerCase();
      const subCategory = (c.subCategory || "").toLowerCase();
      const creatorName = (c.creatorName || "").toLowerCase();
      
      return title.includes(searchTerm) ||
             description.includes(searchTerm) ||
             subCategory.includes(searchTerm) ||
             creatorName.includes(searchTerm);
    });

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
      query: q,
      category: category || null,
    });
  } catch (err) {
    console.error("search-classes error:", err);
    return res.status(500).json({ error: err.message });
  }
}

