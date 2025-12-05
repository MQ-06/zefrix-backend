// api/creator-analytics.js - Get creator analytics
import { db } from "./_firebase.js";
import { verifyCreator } from "./_authCreator.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { uid } = await verifyCreator(req);

    // Get all creator's classes
    const classesSnapshot = await db.collection("classes")
      .where("creatorUid", "==", uid)
      .get();

    const classes = classesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Get all enrollments for creator's classes
    const classIds = classes.map(c => c.id);
    let allEnrollments = [];

    if (classIds.length > 0) {
      // Firestore 'in' query limit is 10, so batch if needed
      const batches = [];
      for (let i = 0; i < classIds.length; i += 10) {
        batches.push(classIds.slice(i, i + 10));
      }

      for (const batch of batches) {
        const enrollmentsSnapshot = await db.collection("enrollments")
          .where("classId", "in", batch)
          .get();
        allEnrollments.push(...enrollmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    }

    // Calculate analytics
    const analytics = {
      totalClasses: classes.length,
      pendingClasses: classes.filter(c => c.approvalStatus === "pending").length,
      approvedClasses: classes.filter(c => c.approvalStatus === "approved").length,
      rejectedClasses: classes.filter(c => c.approvalStatus === "rejected").length,
      totalEnrollments: allEnrollments.length,
      totalRevenue: classes.reduce((sum, c) => {
        const enrollments = allEnrollments.filter(e => e.classId === c.id);
        return sum + (c.price * enrollments.length);
      }, 0),
      classesBreakdown: classes.map(c => {
        const enrollments = allEnrollments.filter(e => e.classId === c.id);
        return {
          classId: c.id,
          title: c.title,
          status: c.approvalStatus,
          enrollments: enrollments.length,
          revenue: c.price * enrollments.length,
          maxLearners: c.maxLearners,
          fillRate: c.maxLearners > 0 ? ((enrollments.length / c.maxLearners) * 100).toFixed(2) + "%" : "0%",
        };
      }),
    };

    return res.status(200).json({ success: true, analytics });
  } catch (err) {
    console.error("creator-analytics error:", err);
    if (err.code === "not-authorized" || err.code === "no-token") {
      return res.status(403).json({ error: "Not authorized" });
    }
    return res.status(500).json({ error: err.message });
  }
}

