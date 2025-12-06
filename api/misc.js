// api/misc.js - Combined miscellaneous endpoints
import { db } from "./_firebase.js";
import { setCORSHeaders } from "./_cors.js";

export default async function handler(req, res) {
  setCORSHeaders(req, res);
  
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { action, creatorUid, classId } = req.query;

  try {
    // Get categories
    if (action === "categories") {
      const classesSnapshot = await db.collection("classes")
        .where("approvalStatus", "==", "approved").get();
      
      const categoryMap = new Map();
      classesSnapshot.docs.forEach(doc => {
        const classData = doc.data();
        const category = classData.category;
        const subCategory = classData.subCategory;
        
        if (category) {
          if (!categoryMap.has(category)) {
            categoryMap.set(category, { name: category, subCategories: new Set(), classCount: 0 });
          }
          const cat = categoryMap.get(category);
          cat.classCount++;
          if (subCategory) cat.subCategories.add(subCategory);
        }
      });
      
      const categories = Array.from(categoryMap.values()).map(cat => ({
        name: cat.name, subCategories: Array.from(cat.subCategories), classCount: cat.classCount,
      }));
      
      categories.sort((a, b) => b.classCount - a.classCount);
      return res.status(200).json({ success: true, categories, count: categories.length });
    }

    // Get creator public profile
    if (action === "creator-profile") {
      if (!creatorUid) return res.status(400).json({ error: "creatorUid required" });
      
      const creatorDoc = await db.collection("creators").doc(creatorUid).get();
      const userDoc = await db.collection("users").doc(creatorUid).get();
      if (!creatorDoc.exists && !userDoc.exists) return res.status(404).json({ error: "Creator not found" });
      
      const creatorData = creatorDoc.exists ? creatorDoc.data() : {};
      const userData = userDoc.exists ? userDoc.data() : {};
      
      const classesSnapshot = await db.collection("classes")
        .where("creatorUid", "==", creatorUid).where("approvalStatus", "==", "approved").get();
      const classes = classesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const now = new Date();
      const upcomingClasses = classes.filter(c => {
        const startTime = c.startTime?.toDate?.() || new Date(c.startTime);
        return startTime > now;
      });
      
      let totalEnrollments = 0;
      for (const classItem of classes) {
        const enrollmentsSnapshot = await db.collection("enrollments").where("classId", "==", classItem.id).get();
        totalEnrollments += enrollmentsSnapshot.size;
      }
      
      let averageRating = 0, reviewsCount = 0;
      try {
        const reviewsSnapshot = await db.collection("reviews").where("creatorUid", "==", creatorUid).get();
        reviewsCount = reviewsSnapshot.size;
        if (reviewsCount > 0) {
          const ratings = reviewsSnapshot.docs.map(doc => doc.data().rating || 0);
          averageRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
        }
      } catch (e) {}
      
      const profile = {
        uid: creatorUid, name: creatorData.name || userData.name || "",
        bio: creatorData.bio || "", expertise: creatorData.expertise || [],
        profileImageUrl: creatorData.profileImageUrl || "", introVideoUrl: creatorData.introVideoUrl || "",
        socialHandles: creatorData.socialHandles || {},
        stats: {
          totalClasses: classes.length, upcomingClasses: upcomingClasses.length,
          totalEnrollments, averageRating: averageRating.toFixed(1), reviewsCount,
        },
        upcomingClasses: upcomingClasses.slice(0, 10),
      };
      
      return res.status(200).json({ success: true, profile });
    }

    // Get class reviews
    if (action === "class-reviews") {
      if (!classId) return res.status(400).json({ error: "classId required" });
      
      const { limit = 50 } = req.query;
      const snapshot = await db.collection("reviews")
        .where("classId", "==", classId)
        .orderBy("createdAt", "desc")
        .limit(parseInt(limit))
        .get();
      
      const reviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      let averageRating = 0;
      if (reviews.length > 0) {
        const ratings = reviews.map(r => r.rating || 0);
        averageRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
      }
      
      return res.status(200).json({
        success: true, reviews, count: reviews.length,
        averageRating: averageRating.toFixed(1), classId,
      });
    }

    return res.status(404).json({ error: "Action not found" });
  } catch (err) {
    console.error("misc error:", err);
    return res.status(500).json({ error: err.message });
  }
}

