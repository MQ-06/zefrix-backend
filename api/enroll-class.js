// api/enroll-class.js - Student enrolls in a class (creates enrollment record)
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
    const { classId } = req.body;

    if (!classId) {
      return res.status(400).json({ error: "classId required" });
    }

    // Get class details
    const classDoc = await db.collection("classes").doc(classId).get();
    if (!classDoc.exists) {
      return res.status(404).json({ error: "Class not found" });
    }

    const classData = classDoc.data();

    // Check if class is approved
    if (classData.approvalStatus !== "approved") {
      return res.status(400).json({ error: "Class is not available for enrollment" });
    }

    // Check if already enrolled
    const existingEnrollment = await db.collection("enrollments")
      .where("classId", "==", classId)
      .where("studentUid", "==", uid)
      .get();

    if (!existingEnrollment.empty) {
      return res.status(400).json({ error: "Already enrolled in this class" });
    }

    // Check if class is full
    const enrollmentsSnapshot = await db.collection("enrollments")
      .where("classId", "==", classId)
      .get();

    if (enrollmentsSnapshot.size >= classData.maxLearners) {
      return res.status(400).json({ error: "Class is full" });
    }

    // Create enrollment record
    const enrollmentData = {
      classId,
      studentUid: uid,
      studentEmail: user.email || "",
      studentName: user.name || "",
      status: "enrolled",
      price: classData.price,
      createdAt: adminLib.firestore.FieldValue.serverTimestamp(),
    };

    const enrollmentRef = await db.collection("enrollments").add(enrollmentData);
    const enrollmentId = enrollmentRef.id;

    return res.status(201).json({
      success: true,
      message: "Enrolled successfully. Proceed to payment.",
      enrollmentId,
      enrollment: { id: enrollmentId, ...enrollmentData },
      class: {
        id: classId,
        title: classData.title,
        price: classData.price,
      },
    });
  } catch (err) {
    console.error("enroll-class error:", err);
    if (err.code === "not-authorized" || err.code === "no-token") {
      return res.status(403).json({ error: "Not authorized" });
    }
    return res.status(500).json({ error: err.message });
  }
}

