// api/submit-review.js - Submit class review/rating
import { db, adminLib } from "./_firebase.js";
import { verifyStudent } from "./_authStudent.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { uid, user } = await verifyStudent(req);
    const { classId, rating, comment } = req.body;

    if (!classId || !rating) {
      return res.status(400).json({ error: "classId and rating required" });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    // Verify student is enrolled and class is completed
    const enrollmentSnapshot = await db.collection("enrollments")
      .where("classId", "==", classId)
      .where("studentUid", "==", uid)
      .where("status", "==", "paid")
      .get();

    if (enrollmentSnapshot.empty) {
      return res.status(403).json({ error: "Must be enrolled and paid to review" });
    }

    // Check if already reviewed
    const existingReview = await db.collection("reviews")
      .where("classId", "==", classId)
      .where("studentUid", "==", uid)
      .get();

    if (!existingReview.empty) {
      return res.status(400).json({ error: "Already reviewed this class" });
    }

    // Get class and creator info
    const classDoc = await db.collection("classes").doc(classId).get();
    if (!classDoc.exists) {
      return res.status(404).json({ error: "Class not found" });
    }

    const classData = classDoc.data();

    // Create review
    const reviewData = {
      classId,
      creatorUid: classData.creatorUid,
      studentUid: uid,
      studentName: user.name || "",
      studentEmail: user.email || "",
      rating: parseInt(rating),
      comment: comment || "",
      createdAt: adminLib.firestore.FieldValue.serverTimestamp(),
    };

    const reviewRef = await db.collection("reviews").add(reviewData);
    const reviewId = reviewRef.id;

    return res.status(201).json({
      success: true,
      message: "Review submitted successfully",
      review: { id: reviewId, ...reviewData },
    });
  } catch (err) {
    console.error("submit-review error:", err);
    if (err.code === "not-authorized" || err.code === "no-token") {
      return res.status(403).json({ error: "Not authorized" });
    }
    return res.status(500).json({ error: err.message });
  }
}

