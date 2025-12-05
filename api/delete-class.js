// api/delete-class.js - Creator deletes their class
import { db } from "./_firebase.js";
import { verifyCreator } from "./_authCreator.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "DELETE,OPTIONS,POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  
  // Handle DELETE via POST body (some clients don't support DELETE with body)
  const method = req.method === "POST" && req.body._method === "DELETE" ? "DELETE" : req.method;
  if (method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { uid } = await verifyCreator(req);
    const { classId } = req.method === "POST" ? req.body : { classId: req.query.classId };

    if (!classId) return res.status(400).json({ error: "classId required" });

    const classRef = db.collection("classes").doc(classId);
    const doc = await classRef.get();

    if (!doc.exists) return res.status(404).json({ error: "Class not found" });

    const classData = doc.data();
    
    // Verify creator owns this class
    if (classData.creatorUid !== uid) {
      return res.status(403).json({ error: "Not authorized to delete this class" });
    }

    // Check if class has enrollments
    const enrollmentsSnapshot = await db.collection("enrollments")
      .where("classId", "==", classId)
      .get();

    if (enrollmentsSnapshot.size > 0) {
      return res.status(400).json({
        error: "Cannot delete class with existing enrollments",
        enrollmentCount: enrollmentsSnapshot.size,
      });
    }

    await classRef.delete();

    return res.status(200).json({
      success: true,
      message: "Class deleted successfully",
      classId,
    });
  } catch (err) {
    console.error("delete-class error:", err);
    if (err.code === "not-authorized" || err.code === "no-token") {
      return res.status(403).json({ error: "Not authorized" });
    }
    return res.status(500).json({ error: err.message });
  }
}

