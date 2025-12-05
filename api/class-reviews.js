// api/class-reviews.js - Get reviews for a class
import { db } from "./_firebase.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { classId, limit = 50 } = req.query;

    if (!classId) {
      return res.status(400).json({ error: "classId required" });
    }

    const snapshot = await db.collection("reviews")
      .where("classId", "==", classId)
      .orderBy("createdAt", "desc")
      .limit(parseInt(limit))
      .get();

    const reviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Calculate average rating
    let averageRating = 0;
    if (reviews.length > 0) {
      const ratings = reviews.map(r => r.rating || 0);
      averageRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
    }

    return res.status(200).json({
      success: true,
      reviews,
      count: reviews.length,
      averageRating: averageRating.toFixed(1),
      classId,
    });
  } catch (err) {
    console.error("class-reviews error:", err);
    return res.status(500).json({ error: err.message });
  }
}

