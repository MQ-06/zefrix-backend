// api/admin.js - Combined admin endpoints
import { db, adminLib } from "./_firebase.js";
import { verifyAdmin } from "./_authAdmin.js";
import { setCORSHeaders } from "./_cors.js";

export default async function handler(req, res) {
  setCORSHeaders(req, res);
  
  if (req.method === "OPTIONS") return res.status(204).end();

  const { action } = req.query;

  try {
    // Stats endpoint
    if (action === "stats" && req.method === "GET") {
      await verifyAdmin(req);
      
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
    }

    // Classes endpoint
    if (action === "classes" && req.method === "GET") {
      await verifyAdmin(req);
      
      const { status, limit = 100 } = req.query;
      let query = db.collection("classes");
      
      if (status && ["pending", "approved", "rejected"].includes(status)) {
        query = query.where("approvalStatus", "==", status);
      }

      const snapshot = await query.get();
      let classes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      classes.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt?._seconds || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt?._seconds || 0;
        return bTime - aTime;
      });
      
      classes = classes.slice(0, parseInt(limit));
      return res.status(200).json({ success: true, classes, count: classes.length });
    }

    // Enrollments endpoint
    if (action === "enrollments" && req.method === "GET") {
      await verifyAdmin(req);
      
      const { classId, limit = 100 } = req.query;
      let query = db.collection("enrollments");
      
      if (classId) {
        query = query.where("classId", "==", classId);
      }
      
      const snapshot = await query.get();
      const enrollments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      enrollments.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt?._seconds || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt?._seconds || 0;
        return bTime - aTime;
      });

      return res.status(200).json({ success: true, enrollments: enrollments.slice(0, parseInt(limit)), count: enrollments.length });
    }

    // Approve class
    if (action === "approve" && req.method === "POST") {
      await verifyAdmin(req);
      const { classId } = req.body;
      if (!classId) return res.status(400).json({ error: "classId required" });

      const classRef = db.collection("classes").doc(classId);
      const doc = await classRef.get();
      if (!doc.exists) return res.status(404).json({ error: "Class not found" });

      await classRef.update({
        approvalStatus: "approved",
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const classData = doc.data();
      const adminActionWebhook = process.env.N8N_ADMIN_ACTION_WEBHOOK || "https://n8n.srv1137454.hstgr.cloud/webhook-test/admin-action";
      try {
        await fetch(adminActionWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            classId,
            status: "approved",
            creatorUid: classData.creatorUid || null,
            title: classData.title || "",
            action: "approve",
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (e) {}

      return res.status(200).json({ success: true, message: "Class approved" });
    }

    // Reject class
    if (action === "reject" && req.method === "POST") {
      await verifyAdmin(req);
      const { classId, reason } = req.body;
      if (!classId) return res.status(400).json({ error: "classId required" });

      const classRef = db.collection("classes").doc(classId);
      const doc = await classRef.get();
      if (!doc.exists) return res.status(404).json({ error: "Class not found" });

      await classRef.update({
        approvalStatus: "rejected",
        rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
        rejectionReason: reason || null,
      });

      const classData = doc.data();
      const adminActionWebhook = process.env.N8N_ADMIN_ACTION_WEBHOOK || "https://n8n.srv1137454.hstgr.cloud/webhook-test/admin-action";
      try {
        await fetch(adminActionWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            classId,
            status: "rejected",
            creatorUid: classData.creatorUid || null,
            title: classData.title || "",
            reason: reason || "",
            action: "reject",
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (e) {}

      return res.status(200).json({ success: true, message: "Class rejected" });
    }

    return res.status(404).json({ error: "Action not found" });
  } catch (err) {
    console.error("admin error:", err);
    if (err.code === "not-authorized" || err.code === "no-token") {
      return res.status(403).json({ error: "Not authorized" });
    }
    return res.status(500).json({ error: err.message });
  }
}

