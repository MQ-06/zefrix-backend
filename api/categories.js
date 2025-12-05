// api/categories.js - Get all categories
import { db } from "./_firebase.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    // Get all unique categories from classes
    const classesSnapshot = await db.collection("classes")
      .where("approvalStatus", "==", "approved")
      .get();

    const categoryMap = new Map();

    classesSnapshot.docs.forEach(doc => {
      const classData = doc.data();
      const category = classData.category;
      const subCategory = classData.subCategory;

      if (category) {
        if (!categoryMap.has(category)) {
          categoryMap.set(category, {
            name: category,
            subCategories: new Set(),
            classCount: 0,
          });
        }

        const cat = categoryMap.get(category);
        cat.classCount++;

        if (subCategory) {
          cat.subCategories.add(subCategory);
        }
      }
    });

    // Convert to array format
    const categories = Array.from(categoryMap.values()).map(cat => ({
      name: cat.name,
      subCategories: Array.from(cat.subCategories),
      classCount: cat.classCount,
    }));

    // Sort by class count (most popular first)
    categories.sort((a, b) => b.classCount - a.classCount);

    return res.status(200).json({
      success: true,
      categories,
      count: categories.length,
    });
  } catch (err) {
    console.error("categories error:", err);
    return res.status(500).json({ error: err.message });
  }
}

