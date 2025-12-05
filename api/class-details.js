// api/class-details.js - Get single class details with creator info
import { db } from "./_firebase.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { classId } = req.query;

    if (!classId) {
      return res.status(400).json({ error: "classId query parameter required" });
    }

    const classDoc = await db.collection("classes").doc(classId).get();
    
    if (!classDoc.exists) {
      return res.status(404).json({ error: "Class not found" });
    }

    const classData = { id: classDoc.id, ...classDoc.data() };

    // Get creator profile
    let creator = null;
    if (classData.creatorUid) {
      const creatorDoc = await db.collection("creators").doc(classData.creatorUid).get();
      const userDoc = await db.collection("users").doc(classData.creatorUid).get();
      
      if (creatorDoc.exists || userDoc.exists) {
        creator = {
          uid: classData.creatorUid,
          name: creatorDoc.data()?.name || userDoc.data()?.name || classData.creatorName || "",
          bio: creatorDoc.data()?.bio || "",
          profileImageUrl: creatorDoc.data()?.profileImageUrl || "",
        };
      }
    }

    // Get enrollment count
    const enrollmentsSnapshot = await db.collection("enrollments")
      .where("classId", "==", classId)
      .get();
    
    const enrollmentCount = enrollmentsSnapshot.size;
    const availableSpots = classData.maxLearners - enrollmentCount;

    // Get reviews count (if reviews collection exists)
    let reviewsCount = 0;
    let averageRating = 0;
    try {
      const reviewsSnapshot = await db.collection("reviews")
        .where("classId", "==", classId)
        .get();
      reviewsCount = reviewsSnapshot.size;
      
      if (reviewsCount > 0) {
        const ratings = reviewsSnapshot.docs.map(doc => doc.data().rating || 0);
        averageRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
      }
    } catch (e) {
      // Reviews collection might not exist yet
    }

    return res.status(200).json({
      success: true,
      class: {
        ...classData,
        enrollmentCount,
        availableSpots,
        reviewsCount,
        averageRating: averageRating.toFixed(1),
      },
      creator,
    });
  } catch (err) {
    console.error("class-details error:", err);
    return res.status(500).json({ error: err.message });
  }
}

