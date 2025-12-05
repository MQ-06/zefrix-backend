// api/class-enrollments.js - Get enrollments for a specific class (creator view)
import { db } from "./_firebase.js";
import { verifyCreator } from "./_authCreator.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { uid } = await verifyCreator(req);
    const { classId } = req.query;

    if (!classId) return res.status(400).json({ error: "classId required" });

    // Verify creator owns this class
    const classDoc = await db.collection("classes").doc(classId).get();
    if (!classDoc.exists) {
      return res.status(404).json({ error: "Class not found" });
    }

    const classData = classDoc.data();
    if (classData.creatorUid !== uid) {
      return res.status(403).json({ error: "Not authorized to view enrollments for this class" });
    }

    // Get enrollments
    const snapshot = await db.collection("enrollments")
      .where("classId", "==", classId)
      .get();

    const enrollments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Sort by createdAt (newest first)
    enrollments.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt?._seconds || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?._seconds || 0;
      return bTime - aTime;
    });

    return res.status(200).json({
      success: true,
      enrollments,
      count: enrollments.length,
      class: {
        id: classId,
        title: classData.title,
        maxLearners: classData.maxLearners,
      },
    });
  } catch (err) {
    console.error("class-enrollments error:", err);
    if (err.code === "not-authorized" || err.code === "no-token") {
      return res.status(403).json({ error: "Not authorized" });
    }
    return res.status(500).json({ error: err.message });
  }
}

