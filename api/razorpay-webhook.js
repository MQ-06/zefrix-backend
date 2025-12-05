// api/razorpay-webhook.js - Handle Razorpay payment webhook and forward to n8n
import { db, adminLib } from "./_firebase.js";
import crypto from "crypto";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const razorpaySignature = req.headers["x-razorpay-signature"];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Verify webhook signature (in production)
    if (webhookSecret && razorpaySignature) {
      const payload = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(payload)
        .digest("hex");

      if (razorpaySignature !== expectedSignature) {
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    const paymentData = req.body;

    // Only process successful payments
    if (paymentData.event === "payment.captured" || paymentData.event === "payment.authorized") {
      const payment = paymentData.payload?.payment?.entity || paymentData.payload?.payment;
      
      if (!payment) {
        return res.status(400).json({ error: "Invalid payment data" });
      }

      // Extract enrollment and class info from notes
      const notes = payment.notes || {};
      const enrollmentId = notes.enrollmentId;
      const classId = notes.classId;
      const studentUid = notes.studentUid;

      if (enrollmentId && classId) {
        // Update enrollment status
        const enrollmentSnapshot = await db.collection("enrollments")
          .where("id", "==", enrollmentId)
          .get();

        if (!enrollmentSnapshot.empty) {
          const enrollmentRef = enrollmentSnapshot.docs[0].ref;
          await enrollmentRef.update({
            status: "paid",
            paymentId: payment.id,
            paymentStatus: payment.status,
            paidAt: adminLib.firestore.FieldValue.serverTimestamp(),
          });
        }
      }

      // Forward to n8n webhook
      const razorpayWebhook = process.env.N8N_RAZORPAY_WEBHOOK || "https://n8n.srv1137454.hstgr.cloud/webhook-test/razorpay-payment";
      try {
        await fetch(razorpayWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...paymentData,
            processedAt: new Date().toISOString(),
          }),
        });
      } catch (webhookError) {
        console.error("n8n razorpay webhook error:", webhookError);
        // Don't fail the request if webhook fails
      }
    }

    return res.status(200).json({ success: true, message: "Webhook processed" });
  } catch (err) {
    console.error("razorpay-webhook error:", err);
    return res.status(500).json({ error: err.message });
  }
}

