// api/class-meet-link.js - Get Meet link for live class
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
    const { classId } = req.query;

    if (!classId) {
      return res.status(400).json({ error: "classId required" });
    }

    // Verify student is enrolled
    const enrollmentSnapshot = await db.collection("enrollments")
      .where("classId", "==", classId)
      .where("studentUid", "==", uid)
      .where("status", "==", "paid")
      .get();

    if (enrollmentSnapshot.empty) {
      return res.status(403).json({ error: "Not enrolled or payment not completed" });
    }

    // Get class details
    const classDoc = await db.collection("classes").doc(classId).get();
    if (!classDoc.exists) {
      return res.status(404).json({ error: "Class not found" });
    }

    const classData = classDoc.data();

    // Check if class is live or upcoming
    const startTime = classData.startTime?.toDate?.() || new Date(classData.startTime);
    const now = new Date();
    const timeUntilStart = startTime - now;

    if (classData.status !== "live" && timeUntilStart > 15 * 60 * 1000) {
      return res.status(400).json({
        error: "Class has not started yet",
        startTime: startTime.toISOString(),
        timeUntilStart: Math.floor(timeUntilStart / 1000 / 60), // minutes
      });
    }

    return res.status(200).json({
      success: true,
      meetLink: classData.meetLink || "",
      class: {
        id: classId,
        title: classData.title,
        status: classData.status,
        startTime: startTime.toISOString(),
      },
    });
  } catch (err) {
    console.error("class-meet-link error:", err);
    if (err.code === "not-authorized" || err.code === "no-token") {
      return res.status(403).json({ error: "Not authorized" });
    }
    return res.status(500).json({ error: err.message });
  }
}

