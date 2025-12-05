// api/creator-public-profile.js - Get public creator profile
import { db } from "./_firebase.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { creatorUid } = req.query;

    if (!creatorUid) {
      return res.status(400).json({ error: "creatorUid query parameter required" });
    }

    // Get creator data
    const creatorDoc = await db.collection("creators").doc(creatorUid).get();
    const userDoc = await db.collection("users").doc(creatorUid).get();

    if (!creatorDoc.exists && !userDoc.exists) {
      return res.status(404).json({ error: "Creator not found" });
    }

    const creatorData = creatorDoc.exists ? creatorDoc.data() : {};
    const userData = userDoc.exists ? userDoc.data() : {};

    // Get creator's approved classes
    const classesSnapshot = await db.collection("classes")
      .where("creatorUid", "==", creatorUid)
      .where("approvalStatus", "==", "approved")
      .get();

    const classes = classesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Filter upcoming classes
    const now = new Date();
    const upcomingClasses = classes.filter(c => {
      const startTime = c.startTime?.toDate?.() || new Date(c.startTime);
      return startTime > now;
    });

    // Get total enrollments
    let totalEnrollments = 0;
    for (const classItem of classes) {
      const enrollmentsSnapshot = await db.collection("enrollments")
        .where("classId", "==", classItem.id)
        .get();
      totalEnrollments += enrollmentsSnapshot.size;
    }

    // Get average rating (if reviews exist)
    let averageRating = 0;
    let reviewsCount = 0;
    try {
      const reviewsSnapshot = await db.collection("reviews")
        .where("creatorUid", "==", creatorUid)
        .get();
      reviewsCount = reviewsSnapshot.size;
      
      if (reviewsCount > 0) {
        const ratings = reviewsSnapshot.docs.map(doc => doc.data().rating || 0);
        averageRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
      }
    } catch (e) {
      // Reviews collection might not exist yet
    }

    const profile = {
      uid: creatorUid,
      name: creatorData.name || userData.name || "",
      bio: creatorData.bio || "",
      expertise: creatorData.expertise || [],
      profileImageUrl: creatorData.profileImageUrl || "",
      introVideoUrl: creatorData.introVideoUrl || "",
      socialHandles: creatorData.socialHandles || {},
      stats: {
        totalClasses: classes.length,
        upcomingClasses: upcomingClasses.length,
        totalEnrollments,
        averageRating: averageRating.toFixed(1),
        reviewsCount,
      },
      upcomingClasses: upcomingClasses.slice(0, 10), // Limit to 10 upcoming
    };

    return res.status(200).json({ success: true, profile });
  } catch (err) {
    console.error("creator-public-profile error:", err);
    return res.status(500).json({ error: err.message });
  }
}

