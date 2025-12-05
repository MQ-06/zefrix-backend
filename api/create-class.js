// api/create-class.js - Creator creates a new class/batch
import { db, adminLib } from "./_firebase.js";
import { verifyCreator } from "./_authCreator.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { uid, user } = await verifyCreator(req);

    const {
      title,
      description,
      category,
      subCategory,
      type, // "one-time" or "batch"
      startTime,
      endTime,
      maxLearners,
      price,
      thumbnailUrl,
      bannerUrl,
      sessions, // For batches: array of { date, time, duration }
    } = req.body;

    // Validation
    if (!title || !category || !type || !startTime || !maxLearners || price === undefined) {
      return res.status(400).json({ error: "Missing required fields: title, category, type, startTime, maxLearners, price" });
    }

    if (type !== "one-time" && type !== "batch") {
      return res.status(400).json({ error: "type must be 'one-time' or 'batch'" });
    }

    if (type === "batch" && (!sessions || !Array.isArray(sessions) || sessions.length === 0)) {
      return res.status(400).json({ error: "Batch type requires sessions array" });
    }

    // Create class document
    const classData = {
      title,
      description: description || "",
      category,
      subCategory: subCategory || "",
      type,
      creatorUid: uid,
      creatorEmail: user.email || "",
      creatorName: user.name || "",
      startTime: adminLib.firestore.Timestamp.fromDate(new Date(startTime)),
      endTime: endTime ? adminLib.firestore.Timestamp.fromDate(new Date(endTime)) : null,
      maxLearners: parseInt(maxLearners),
      price: parseFloat(price),
      thumbnailUrl: thumbnailUrl || "",
      bannerUrl: bannerUrl || "",
      sessions: type === "batch" ? sessions : [],
      approvalStatus: "pending",
      createdAt: adminLib.firestore.FieldValue.serverTimestamp(),
      updatedAt: adminLib.firestore.FieldValue.serverTimestamp(),
    };

    // Save to Firestore
    const classRef = await db.collection("classes").add(classData);
    const classId = classRef.id;

    // Call n8n class-create webhook
    const classCreateWebhook = process.env.N8N_CLASS_CREATE_WEBHOOK || "https://n8n.srv1137454.hstgr.cloud/webhook-test/class-create";
    try {
      await fetch(classCreateWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          ...classData,
          startTime: startTime,
          endTime: endTime,
          createdAt: new Date().toISOString(),
        }),
      });
    } catch (webhookError) {
      console.error("Class create webhook error:", webhookError);
      // Don't fail the request if webhook fails
    }

    return res.status(201).json({
      success: true,
      message: "Class created successfully. Awaiting admin approval.",
      classId,
      class: { id: classId, ...classData },
    });
  } catch (err) {
    console.error("create-class error:", err);
    if (err.code === "not-authorized" || err.code === "no-token") {
      return res.status(403).json({ error: "Not authorized" });
    }
    return res.status(500).json({ error: err.message });
  }
}

