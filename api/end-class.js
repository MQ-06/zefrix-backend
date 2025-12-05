// api/end-class.js - End a live class session
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
    const { classId, recordingUrl, summary } = req.body;

    if (!classId) return res.status(400).json({ error: "classId required" });

    const classRef = db.collection("classes").doc(classId);
    const doc = await classRef.get();

    if (!doc.exists) return res.status(404).json({ error: "Class not found" });

    const classData = doc.data();
    
    // Verify creator owns this class
    if (classData.creatorUid !== uid) {
      return res.status(403).json({ error: "Not authorized to end this class" });
    }

    // Update class status
    const updates = {
      status: "completed",
      endedAt: adminLib.firestore.FieldValue.serverTimestamp(),
      updatedAt: adminLib.firestore.FieldValue.serverTimestamp(),
    };

    if (recordingUrl) updates.recordingUrl = recordingUrl;
    if (summary) updates.summary = summary;

    await classRef.update(updates);

    return res.status(200).json({
      success: true,
      message: "Class ended successfully",
      classId,
    });
  } catch (err) {
    console.error("end-class error:", err);
    if (err.code === "not-authorized" || err.code === "no-token") {
      return res.status(403).json({ error: "Not authorized" });
    }
    return res.status(500).json({ error: err.message });
  }
}

