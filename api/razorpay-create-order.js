// api/razorpay-create-order.js - Create Razorpay order for class enrollment
import { db } from "./_firebase.js";
import { verifyStudent } from "./_authStudent.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { uid, user } = await verifyStudent(req);
    const { enrollmentId, classId } = req.body;

    if (!enrollmentId || !classId) {
      return res.status(400).json({ error: "enrollmentId and classId required" });
    }

    // Verify enrollment belongs to student
    const enrollmentSnapshot = await db.collection("enrollments")
      .where("id", "==", enrollmentId)
      .where("studentUid", "==", uid)
      .get();

    if (enrollmentSnapshot.empty) {
      return res.status(404).json({ error: "Enrollment not found" });
    }

    const enrollment = enrollmentSnapshot.docs[0].data();

    // Get class details
    const classDoc = await db.collection("classes").doc(classId).get();
    if (!classDoc.exists) {
      return res.status(404).json({ error: "Class not found" });
    }

    const classData = classDoc.data();

    // Create Razorpay order (you'll need to install razorpay package)
    // For now, return order structure that frontend can use
    const orderData = {
      amount: Math.round(enrollment.price * 100), // Convert to paise
      currency: "INR",
      receipt: `enrollment_${enrollmentId}`,
      notes: {
        enrollmentId,
        classId,
        classTitle: classData.title,
        studentUid: uid,
        studentEmail: user.email || "",
        studentName: user.name || "",
        type: classData.type || "one-time",
      },
    };

    // In production, you would call Razorpay API here:
    // const razorpay = require('razorpay');
    // const order = await razorpay.orders.create(orderData);

    // For now, return mock order structure
    return res.status(200).json({
      success: true,
      message: "Order created. Use Razorpay SDK on frontend with this data.",
      order: {
        id: `order_${Date.now()}`, // Mock order ID
        ...orderData,
        // In production, include: order.id, order.amount, order.currency from Razorpay
      },
      enrollmentId,
      classId,
    });
  } catch (err) {
    console.error("razorpay-create-order error:", err);
    if (err.code === "not-authorized" || err.code === "no-token") {
      return res.status(403).json({ error: "Not authorized" });
    }
    return res.status(500).json({ error: err.message });
  }
}

