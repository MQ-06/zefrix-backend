// api/student-dashboard.js - Get student dashboard data
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

    // Get all enrollments
    const enrollmentsSnapshot = await db.collection("enrollments")
      .where("studentUid", "==", uid)
      .get();

    const enrollments = enrollmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Get class details and categorize
    const now = new Date();
    const upcoming = [];
    const past = [];
    const pending = [];

    for (const enrollment of enrollments) {
      const classDoc = await db.collection("classes").doc(enrollment.classId).get();
      if (!classDoc.exists) continue;

      const classData = { id: classDoc.id, ...classDoc.data() };
      const startTime = classData.startTime?.toDate?.() || new Date(classData.startTime);

      const enrollmentWithClass = {
        ...enrollment,
        class: classData,
        meetLink: classData.meetLink || "",
        status: classData.status || "scheduled",
      };

      if (enrollment.status === "paid" && startTime > now) {
        upcoming.push(enrollmentWithClass);
      } else if (startTime <= now) {
        past.push(enrollmentWithClass);
      } else {
        pending.push(enrollmentWithClass);
      }
    }

    // Sort upcoming by start time
    upcoming.sort((a, b) => {
      const aTime = a.class.startTime?.toDate?.() || new Date(a.class.startTime);
      const bTime = b.class.startTime?.toDate?.() || new Date(b.class.startTime);
      return aTime - bTime;
    });

    // Sort past by start time (newest first)
    past.sort((a, b) => {
      const aTime = a.class.startTime?.toDate?.() || new Date(a.class.startTime);
      const bTime = b.class.startTime?.toDate?.() || new Date(b.class.startTime);
      return bTime - aTime;
    });

    return res.status(200).json({
      success: true,
      dashboard: {
        upcomingClasses: upcoming,
        pastClasses: past,
        pendingPayments: pending,
        stats: {
          totalEnrollments: enrollments.length,
          upcomingCount: upcoming.length,
          completedCount: past.length,
          pendingPaymentCount: pending.length,
        },
      },
    });
  } catch (err) {
    console.error("student-dashboard error:", err);
    if (err.code === "not-authorized" || err.code === "no-token") {
      return res.status(403).json({ error: "Not authorized" });
    }
    return res.status(500).json({ error: err.message });
  }
}

