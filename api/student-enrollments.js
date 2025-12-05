// api/student-enrollments.js - Get student's enrolled classes
import { db } from "./_firebase.js";
import { verifyStudent } from "./_authStudent.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { uid } = await verifyStudent(req);
    const { status } = req.query; // Optional: "enrolled", "paid", "completed"

    let query = db.collection("enrollments").where("studentUid", "==", uid);

    if (status) {
      query = query.where("status", "==", status);
    }

    const snapshot = await query.get();
    const enrollments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Get class details for each enrollment
    const enrollmentsWithClasses = await Promise.all(
      enrollments.map(async (enrollment) => {
        const classDoc = await db.collection("classes").doc(enrollment.classId).get();
        const classData = classDoc.exists ? { id: classDoc.id, ...classDoc.data() } : null;

        return {
          ...enrollment,
          class: classData,
        };
      })
    );

    // Sort by createdAt (newest first)
    enrollmentsWithClasses.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt?._seconds || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?._seconds || 0;
      return bTime - aTime;
    });

    return res.status(200).json({
      success: true,
      enrollments: enrollmentsWithClasses,
      count: enrollmentsWithClasses.length,
    });
  } catch (err) {
    console.error("student-enrollments error:", err);
    if (err.code === "not-authorized" || err.code === "no-token") {
      return res.status(403).json({ error: "Not authorized" });
    }
    return res.status(500).json({ error: err.message });
  }
}

