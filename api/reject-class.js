// api/reject-class.js
import { db } from "./_firebase.js";
import { verifyAdmin } from "./_authAdmin.js";
import { adminLib } from "./_firebase.js"; // optional if you want serverTimestamp

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    await verifyAdmin(req);

    const { classId, reason } = req.body;
    if (!classId) return res.status(400).json({ error: "classId required" });

    const classRef = db.collection("classes").doc(classId);
    const doc = await classRef.get();
    if (!doc.exists) return res.status(404).json({ error: "Class not found" });

    await classRef.update({
      approvalStatus: "rejected",
      rejectedAt: adminLib ? adminLib.firestore.FieldValue.serverTimestamp() : new Date(),
      rejectionReason: reason || null,
    });

    const classData = doc.data();
    const payload = {
      classId,
      status: "rejected",
      creatorUid: classData.creatorUid || null,
      title: classData.title || "",
      reason: reason || ""
    };

    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    return res.status(200).json({ success: true, message: "Class rejected" });
  } catch (err) {
    console.error("reject-class error:", err);
    if (err.code === "not-authorized") return res.status(403).json({ error: "Not authorized" });
    return res.status(500).json({ error: err.message });
  }
}
