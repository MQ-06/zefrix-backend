// api/start-class.js - Start a live class session
import { db, adminLib } from "./_firebase.js";
import { verifyCreator } from "./_authCreator.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { uid } = await verifyCreator(req);
    const { classId, meetLink } = req.body;

    if (!classId) return res.status(400).json({ error: "classId required" });

    const classRef = db.collection("classes").doc(classId);
    const doc = await classRef.get();

    if (!doc.exists) return res.status(404).json({ error: "Class not found" });

    const classData = doc.data();
    
    // Verify creator owns this class
    if (classData.creatorUid !== uid) {
      return res.status(403).json({ error: "Not authorized to start this class" });
    }

    // Check if class is approved
    if (classData.approvalStatus !== "approved") {
      return res.status(400).json({ error: "Class must be approved before starting" });
    }

    // Update class status
    await classRef.update({
      status: "live",
      meetLink: meetLink || classData.meetLink || "",
      startedAt: adminLib.firestore.FieldValue.serverTimestamp(),
      updatedAt: adminLib.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      success: true,
      message: "Class started successfully",
      classId,
      meetLink: meetLink || classData.meetLink || "",
    });
  } catch (err) {
    console.error("start-class error:", err);
    if (err.code === "not-authorized" || err.code === "no-token") {
      return res.status(403).json({ error: "Not authorized" });
    }
    return res.status(500).json({ error: err.message });
  }
}

