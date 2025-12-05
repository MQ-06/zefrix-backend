// api/admin-stats.js
import { db } from "./_firebase.js";
import { verifyAdmin } from "./_authAdmin.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    await verifyAdmin(req);

    // Get counts for different collections
    const [classesSnapshot, pendingClassesSnapshot, approvedClassesSnapshot, 
           rejectedClassesSnapshot, enrollmentsSnapshot, usersSnapshot, creatorsSnapshot] = await Promise.all([
      db.collection("classes").get(),
      db.collection("classes").where("approvalStatus", "==", "pending").get(),
      db.collection("classes").where("approvalStatus", "==", "approved").get(),
      db.collection("classes").where("approvalStatus", "==", "rejected").get(),
      db.collection("enrollments").get(),
      db.collection("users").get(),
      db.collection("creators").get(),
    ]);

    const stats = {
      totalClasses: classesSnapshot.size,
      pendingClasses: pendingClassesSnapshot.size,
      approvedClasses: approvedClassesSnapshot.size,
      rejectedClasses: rejectedClassesSnapshot.size,
      totalEnrollments: enrollmentsSnapshot.size,
      totalUsers: usersSnapshot.size,
      totalCreators: creatorsSnapshot.size,
    };

    return res.status(200).json({ success: true, stats });
  } catch (err) {
    console.error("admin-stats error:", err);
    if (err.code === "not-authorized" || err.code === "no-token") {
      return res.status(403).json({ error: "Not authorized" });
    }
    return res.status(500).json({ error: err.message });
  }
}

