// api/payment.js - Combined payment endpoints
import { db, adminLib } from "./_firebase.js";
import { verifyStudent } from "./_authStudent.js";
import { setCORSHeaders } from "./_cors.js";
import crypto from "crypto";

export default async function handler(req, res) {
  setCORSHeaders(req, res);
  
  if (req.method === "OPTIONS") return res.status(204).end();

  const { action } = req.query;

  try {
    // Create Razorpay order
    if (action === "create-order" && req.method === "POST") {
      const { uid, user } = await verifyStudent(req);
      const { enrollmentId, classId } = req.body;
      if (!enrollmentId || !classId) return res.status(400).json({ error: "enrollmentId and classId required" });
      
      const enrollmentSnapshot = await db.collection("enrollments")
        .where("id", "==", enrollmentId).where("studentUid", "==", uid).get();
      if (enrollmentSnapshot.empty) return res.status(404).json({ error: "Enrollment not found" });
      
      const enrollment = enrollmentSnapshot.docs[0].data();
      const classDoc = await db.collection("classes").doc(classId).get();
      if (!classDoc.exists) return res.status(404).json({ error: "Class not found" });
      
      const classData = classDoc.data();
      const orderData = {
        amount: Math.round(enrollment.price * 100),
        currency: "INR",
        receipt: `enrollment_${enrollmentId}`,
        notes: {
          enrollmentId, classId, classTitle: classData.title,
          studentUid: uid, studentEmail: user.email || "", studentName: user.name || "",
          type: classData.type || "one-time",
        },
      };
      
      return res.status(200).json({
        success: true, message: "Order created",
        order: { id: `order_${Date.now()}`, ...orderData },
        enrollmentId, classId,
      });
    }

    // Razorpay webhook
    if (action === "webhook" && req.method === "POST") {
      const razorpaySignature = req.headers["x-razorpay-signature"];
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      
      if (webhookSecret && razorpaySignature) {
        const payload = JSON.stringify(req.body);
        const expectedSignature = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");
        if (razorpaySignature !== expectedSignature) {
          return res.status(401).json({ error: "Invalid signature" });
        }
      }
      
      const paymentData = req.body;
      if (paymentData.event === "payment.captured" || paymentData.event === "payment.authorized") {
        const payment = paymentData.payload?.payment?.entity || paymentData.payload?.payment;
        if (!payment) return res.status(400).json({ error: "Invalid payment data" });
        
        const notes = payment.notes || {};
        const enrollmentId = notes.enrollmentId;
        const classId = notes.classId;
        
        if (enrollmentId && classId) {
          const enrollmentSnapshot = await db.collection("enrollments").where("id", "==", enrollmentId).get();
          if (!enrollmentSnapshot.empty) {
            const enrollmentRef = enrollmentSnapshot.docs[0].ref;
            await enrollmentRef.update({
              status: "paid", paymentId: payment.id, paymentStatus: payment.status,
              paidAt: adminLib.firestore.FieldValue.serverTimestamp(),
            });
          }
        }
        
        const razorpayWebhook = process.env.N8N_RAZORPAY_WEBHOOK || "https://n8n.srv1137454.hstgr.cloud/webhook-test/razorpay-payment";
        try {
          await fetch(razorpayWebhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...paymentData, processedAt: new Date().toISOString() }),
          });
        } catch (e) {}
      }
      
      return res.status(200).json({ success: true, message: "Webhook processed" });
    }

    return res.status(404).json({ error: "Action not found" });
  } catch (err) {
    console.error("payment error:", err);
    return res.status(500).json({ error: err.message });
  }
}

