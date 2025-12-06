// api/admin-stats.js
import { db } from "./_firebase.js";
import { verifyAdmin } from "./_authAdmin.js";

export default async function handler(req, res) {
  // FIXED CORS: Allow both webflow.io and design.webflow.com
  const allowedOrigins = [
    'https://zefrix-final.webflow.io',
    'https://zefrix-final.design.webflow.com',
    'http://localhost:3000',
  ];
  
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  
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
    
    //console.log("📊 Stats returned:", stats);
    return res.status(200).json({ success: true, stats });
    
  } catch (err) {
    //console.error("admin-stats error:", err);
    if (err.code === "not-authorized" || err.code === "no-token") {
      return res.status(403).json({ error: "Not authorized" });
    }
    return res.status(500).json({ error: err.message });
  }
}
