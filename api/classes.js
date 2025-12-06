// api/classes.js - Combined class discovery endpoints
import { db } from "./_firebase.js";
import { setCORSHeaders } from "./_cors.js";

export default async function handler(req, res) {
  setCORSHeaders(req, res);
  
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { action, category, subCategory, creatorUid, q, classId, status = "approved" } = req.query;

  try {
    // List all classes
    if (!action || action === "list") {
      const snapshot = await db.collection("classes").get();
      const classes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return res.status(200).json({ success: true, classes });
    }

    // Get pending classes
    if (action === "pending") {
      const snapshot = await db.collection("classes")
        .where("approvalStatus", "==", "pending")
        .get();
      let classes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      classes.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt?._seconds || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt?._seconds || 0;
        return bTime - aTime;
      });
      return res.status(200).json({ success: true, classes });
    }

    // Get by category
    if (action === "by-category") {
      if (!category) return res.status(400).json({ error: "category required" });
      
      let query = db.collection("classes")
        .where("category", "==", category)
        .where("approvalStatus", "==", status);
      
      const snapshot = await query.get();
      let classes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (subCategory) {
        classes = classes.filter(c => c.subCategory === subCategory);
      }
      
      const now = new Date();
      classes = classes.filter(c => {
        const startTime = c.startTime?.toDate?.() || new Date(c.startTime);
        return startTime > now;
      });
      
      classes.sort((a, b) => {
        const aTime = a.startTime?.toDate?.() || new Date(a.startTime);
        const bTime = b.startTime?.toDate?.() || new Date(b.startTime);
        return aTime - bTime;
      });
      
      return res.status(200).json({ success: true, classes, count: classes.length, category, subCategory: subCategory || null });
    }

    // Get by creator
    if (action === "by-creator") {
      if (!creatorUid) return res.status(400).json({ error: "creatorUid required" });
      
      const snapshot = await db.collection("classes")
        .where("creatorUid", "==", creatorUid)
        .where("approvalStatus", "==", status)
        .get();
      
      let classes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const now = new Date();
      classes = classes.filter(c => {
        const startTime = c.startTime?.toDate?.() || new Date(c.startTime);
        return startTime > now;
      });
      
      classes.sort((a, b) => {
        const aTime = a.startTime?.toDate?.() || new Date(a.startTime);
        const bTime = b.startTime?.toDate?.() || new Date(b.startTime);
        return aTime - bTime;
      });
      
      return res.status(200).json({ success: true, classes, count: classes.length, creatorUid });
    }

    // Search classes
    if (action === "search") {
      if (!q) return res.status(400).json({ error: "q (query) required" });
      
      let query = db.collection("classes").where("approvalStatus", "==", status);
      if (category) {
        query = query.where("category", "==", category);
      }
      
      const snapshot = await query.get();
      let classes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const searchTerm = q.toLowerCase();
      classes = classes.filter(c => {
        const title = (c.title || "").toLowerCase();
        const description = (c.description || "").toLowerCase();
        const subCategory = (c.subCategory || "").toLowerCase();
        const creatorName = (c.creatorName || "").toLowerCase();
        return title.includes(searchTerm) || description.includes(searchTerm) || 
               subCategory.includes(searchTerm) || creatorName.includes(searchTerm);
      });
      
      const now = new Date();
      classes = classes.filter(c => {
        const startTime = c.startTime?.toDate?.() || new Date(c.startTime);
        return startTime > now;
      });
      
      classes.sort((a, b) => {
        const aTime = a.startTime?.toDate?.() || new Date(a.startTime);
        const bTime = b.startTime?.toDate?.() || new Date(b.startTime);
        return aTime - bTime;
      });
      
      return res.status(200).json({ success: true, classes, count: classes.length, query: q, category: category || null });
    }

    // Get class details
    if (action === "details") {
      if (!classId) return res.status(400).json({ error: "classId required" });
      
      const classDoc = await db.collection("classes").doc(classId).get();
      if (!classDoc.exists) return res.status(404).json({ error: "Class not found" });
      
      const classData = { id: classDoc.id, ...classDoc.data() };
      
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
      
      const enrollmentsSnapshot = await db.collection("enrollments")
        .where("classId", "==", classId)
        .get();
      
      const enrollmentCount = enrollmentsSnapshot.size;
      const availableSpots = classData.maxLearners - enrollmentCount;
      
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
      } catch (e) {}
      
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
    }

    return res.status(404).json({ error: "Action not found" });
  } catch (err) {
    console.error("classes error:", err);
    return res.status(500).json({ error: err.message });
  }
}

