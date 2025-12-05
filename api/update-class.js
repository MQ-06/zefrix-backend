// api/update-class.js - Creator updates their class
import { db, adminLib } from "./_firebase.js";
import { verifyCreator } from "./_authCreator.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "PUT,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "PUT") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { uid } = await verifyCreator(req);
    const { classId, ...updateData } = req.body;

    if (!classId) return res.status(400).json({ error: "classId required" });

    const classRef = db.collection("classes").doc(classId);
    const doc = await classRef.get();

    if (!doc.exists) return res.status(404).json({ error: "Class not found" });

    const classData = doc.data();
    
    // Verify creator owns this class
    if (classData.creatorUid !== uid) {
      return res.status(403).json({ error: "Not authorized to update this class" });
    }

    // Only allow updates if pending or approved (can't update rejected)
    if (classData.approvalStatus === "rejected") {
      return res.status(400).json({ error: "Cannot update rejected class" });
    }

    // Prepare update object
    const updates = {
      updatedAt: adminLib.firestore.FieldValue.serverTimestamp(),
    };

    // Allow updating these fields
    const allowedFields = [
      "title", "description", "category", "subCategory",
      "startTime", "endTime", "maxLearners", "price",
      "thumbnailUrl", "bannerUrl", "sessions"
    ];

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        if (field === "startTime" || field === "endTime") {
          updates[field] = adminLib.firestore.Timestamp.fromDate(new Date(updateData[field]));
        } else if (field === "maxLearners" || field === "price") {
          updates[field] = parseFloat(updateData[field]);
        } else {
          updates[field] = updateData[field];
        }
      }
    });

    // If updating, reset approval status to pending
    if (Object.keys(updates).length > 1) {
      updates.approvalStatus = "pending";
    }

    await classRef.update(updates);

    return res.status(200).json({
      success: true,
      message: "Class updated successfully. Status reset to pending for admin review.",
      classId,
    });
  } catch (err) {
    console.error("update-class error:", err);
    if (err.code === "not-authorized" || err.code === "no-token") {
      return res.status(403).json({ error: "Not authorized" });
    }
    return res.status(500).json({ error: err.message });
  }
}

