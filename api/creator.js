// api/creator.js - Combined creator endpoints
import { db, adminLib } from "./_firebase.js";
import { verifyCreator } from "./_authCreator.js";
import { setCORSHeaders } from "./_cors.js";

export default async function handler(req, res) {
  setCORSHeaders(req, res);
  
  if (req.method === "OPTIONS") return res.status(204).end();

  const { action } = req.query;

  try {
    // Get creator's classes
    if (action === "classes" && req.method === "GET") {
      const { uid } = await verifyCreator(req);
      const { status, type } = req.query;
      
      let query = db.collection("classes").where("creatorUid", "==", uid);
      if (status && ["pending", "approved", "rejected"].includes(status)) {
        query = query.where("approvalStatus", "==", status);
      }
      
      const snapshot = await query.get();
      let classes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (type && (type === "one-time" || type === "batch")) {
        classes = classes.filter(c => c.type === type);
      }
      
      classes.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt?._seconds || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt?._seconds || 0;
        return bTime - aTime;
      });
      
      return res.status(200).json({ success: true, classes, count: classes.length });
    }

    // Create class
    if (action === "create-class" && req.method === "POST") {
      const { uid, user } = await verifyCreator(req);
      const { title, description, category, subCategory, type, startTime, endTime, maxLearners, price, thumbnailUrl, bannerUrl, sessions } = req.body;
      
      if (!title || !category || !type || !startTime || !maxLearners || price === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      if (type === "batch" && (!sessions || !Array.isArray(sessions) || sessions.length === 0)) {
        return res.status(400).json({ error: "Batch requires sessions array" });
      }
      
      const classData = {
        title, description: description || "", category, subCategory: subCategory || "", type,
        creatorUid: uid, creatorEmail: user.email || "", creatorName: user.name || "",
        startTime: adminLib.firestore.Timestamp.fromDate(new Date(startTime)),
        endTime: endTime ? adminLib.firestore.Timestamp.fromDate(new Date(endTime)) : null,
        maxLearners: parseInt(maxLearners), price: parseFloat(price),
        thumbnailUrl: thumbnailUrl || "", bannerUrl: bannerUrl || "",
        sessions: type === "batch" ? sessions : [],
        approvalStatus: "pending",
        createdAt: adminLib.firestore.FieldValue.serverTimestamp(),
        updatedAt: adminLib.firestore.FieldValue.serverTimestamp(),
      };
      
      const classRef = await db.collection("classes").add(classData);
      const classId = classRef.id;
      
      const classCreateWebhook = process.env.N8N_CLASS_CREATE_WEBHOOK || "https://n8n.srv1137454.hstgr.cloud/webhook-test/class-create";
      try {
        await fetch(classCreateWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classId, ...classData, startTime, endTime, createdAt: new Date().toISOString() }),
        });
      } catch (e) {}
      
      return res.status(201).json({ success: true, message: "Class created", classId, class: { id: classId, ...classData } });
    }

    // Update class
    if (action === "update-class" && req.method === "PUT") {
      const { uid } = await verifyCreator(req);
      const { classId, ...updateData } = req.body;
      if (!classId) return res.status(400).json({ error: "classId required" });
      
      const classRef = db.collection("classes").doc(classId);
      const doc = await classRef.get();
      if (!doc.exists) return res.status(404).json({ error: "Class not found" });
      
      const classData = doc.data();
      if (classData.creatorUid !== uid) return res.status(403).json({ error: "Not authorized" });
      if (classData.approvalStatus === "rejected") return res.status(400).json({ error: "Cannot update rejected class" });
      
      const updates = { updatedAt: adminLib.firestore.FieldValue.serverTimestamp() };
      const allowedFields = ["title", "description", "category", "subCategory", "startTime", "endTime", "maxLearners", "price", "thumbnailUrl", "bannerUrl", "sessions"];
      
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
      
      if (Object.keys(updates).length > 1) updates.approvalStatus = "pending";
      await classRef.update(updates);
      return res.status(200).json({ success: true, message: "Class updated", classId });
    }

    // Delete class
    if (action === "delete-class" && (req.method === "DELETE" || (req.method === "POST" && req.body._method === "DELETE"))) {
      const { uid } = await verifyCreator(req);
      const { classId } = req.method === "POST" ? req.body : { classId: req.query.classId };
      if (!classId) return res.status(400).json({ error: "classId required" });
      
      const classRef = db.collection("classes").doc(classId);
      const doc = await classRef.get();
      if (!doc.exists) return res.status(404).json({ error: "Class not found" });
      
      const classData = doc.data();
      if (classData.creatorUid !== uid) return res.status(403).json({ error: "Not authorized" });
      
      const enrollmentsSnapshot = await db.collection("enrollments").where("classId", "==", classId).get();
      if (enrollmentsSnapshot.size > 0) {
        return res.status(400).json({ error: "Cannot delete class with enrollments", enrollmentCount: enrollmentsSnapshot.size });
      }
      
      await classRef.delete();
      return res.status(200).json({ success: true, message: "Class deleted", classId });
    }

    // Get class enrollments
    if (action === "class-enrollments" && req.method === "GET") {
      const { uid } = await verifyCreator(req);
      const { classId } = req.query;
      if (!classId) return res.status(400).json({ error: "classId required" });
      
      const classDoc = await db.collection("classes").doc(classId).get();
      if (!classDoc.exists) return res.status(404).json({ error: "Class not found" });
      
      const classData = classDoc.data();
      if (classData.creatorUid !== uid) return res.status(403).json({ error: "Not authorized" });
      
      const snapshot = await db.collection("enrollments").where("classId", "==", classId).get();
      let enrollments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      enrollments.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt?._seconds || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt?._seconds || 0;
        return bTime - aTime;
      });
      
      return res.status(200).json({
        success: true, enrollments, count: enrollments.length,
        class: { id: classId, title: classData.title, maxLearners: classData.maxLearners },
      });
    }

    // Get analytics
    if (action === "analytics" && req.method === "GET") {
      const { uid } = await verifyCreator(req);
      
      const classesSnapshot = await db.collection("classes").where("creatorUid", "==", uid).get();
      const classes = classesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const classIds = classes.map(c => c.id);
      
      let allEnrollments = [];
      if (classIds.length > 0) {
        const batches = [];
        for (let i = 0; i < classIds.length; i += 10) {
          batches.push(classIds.slice(i, i + 10));
        }
        for (const batch of batches) {
          const enrollmentsSnapshot = await db.collection("enrollments").where("classId", "in", batch).get();
          allEnrollments.push(...enrollmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
      }
      
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
            classId: c.id, title: c.title, status: c.approvalStatus,
            enrollments: enrollments.length, revenue: c.price * enrollments.length,
            maxLearners: c.maxLearners,
            fillRate: c.maxLearners > 0 ? ((enrollments.length / c.maxLearners) * 100).toFixed(2) + "%" : "0%",
          };
        }),
      };
      
      return res.status(200).json({ success: true, analytics });
    }

    // Get/Update profile
    if (action === "profile") {
      const { uid, user } = await verifyCreator(req);
      
      if (req.method === "GET") {
        const creatorDoc = await db.collection("creators").doc(uid).get();
        const userDoc = await db.collection("users").doc(uid).get();
        const creatorData = creatorDoc.exists ? creatorDoc.data() : {};
        const userData = userDoc.exists ? userDoc.data() : {};
        
        const profile = {
          uid, email: userData.email || user.email || "", name: userData.name || creatorData.name || "",
          bio: creatorData.bio || "", expertise: creatorData.expertise || [],
          socialHandles: creatorData.socialHandles || {}, introVideoUrl: creatorData.introVideoUrl || "",
          profileImageUrl: creatorData.profileImageUrl || "", approved: creatorData.approved || false,
          createdAt: creatorData.createdAt || userData.createdAt,
        };
        return res.status(200).json({ success: true, profile });
      }
      
      if (req.method === "PUT") {
        const { name, bio, expertise, socialHandles, introVideoUrl, profileImageUrl } = req.body;
        const updates = { updatedAt: adminLib.firestore.FieldValue.serverTimestamp() };
        
        if (name !== undefined) updates.name = name;
        if (bio !== undefined) updates.bio = bio;
        if (expertise !== undefined) updates.expertise = Array.isArray(expertise) ? expertise : [];
        if (socialHandles !== undefined) updates.socialHandles = socialHandles || {};
        if (introVideoUrl !== undefined) updates.introVideoUrl = introVideoUrl || "";
        if (profileImageUrl !== undefined) updates.profileImageUrl = profileImageUrl || "";
        
        await db.collection("creators").doc(uid).set(updates, { merge: true });
        if (name !== undefined) {
          await db.collection("users").doc(uid).set({ name }, { merge: true });
        }
        
        return res.status(200).json({ success: true, message: "Profile updated", profile: { uid, ...updates } });
      }
    }

    // Start class
    if (action === "start-class" && req.method === "POST") {
      const { uid } = await verifyCreator(req);
      const { classId, meetLink } = req.body;
      if (!classId) return res.status(400).json({ error: "classId required" });
      
      const classRef = db.collection("classes").doc(classId);
      const doc = await classRef.get();
      if (!doc.exists) return res.status(404).json({ error: "Class not found" });
      
      const classData = doc.data();
      if (classData.creatorUid !== uid) return res.status(403).json({ error: "Not authorized" });
      if (classData.approvalStatus !== "approved") return res.status(400).json({ error: "Class must be approved" });
      
      await classRef.update({
        status: "live", meetLink: meetLink || classData.meetLink || "",
        startedAt: adminLib.firestore.FieldValue.serverTimestamp(),
        updatedAt: adminLib.firestore.FieldValue.serverTimestamp(),
      });
      
      return res.status(200).json({ success: true, message: "Class started", classId, meetLink: meetLink || classData.meetLink || "" });
    }

    // End class
    if (action === "end-class" && req.method === "POST") {
      const { uid } = await verifyCreator(req);
      const { classId, recordingUrl, summary } = req.body;
      if (!classId) return res.status(400).json({ error: "classId required" });
      
      const classRef = db.collection("classes").doc(classId);
      const doc = await classRef.get();
      if (!doc.exists) return res.status(404).json({ error: "Class not found" });
      
      const classData = doc.data();
      if (classData.creatorUid !== uid) return res.status(403).json({ error: "Not authorized" });
      
      const updates = {
        status: "completed", endedAt: adminLib.firestore.FieldValue.serverTimestamp(),
        updatedAt: adminLib.firestore.FieldValue.serverTimestamp(),
      };
      if (recordingUrl) updates.recordingUrl = recordingUrl;
      if (summary) updates.summary = summary;
      
      await classRef.update(updates);
      return res.status(200).json({ success: true, message: "Class ended", classId });
    }

    return res.status(404).json({ error: "Action not found" });
  } catch (err) {
    console.error("creator error:", err);
    if (err.code === "not-authorized" || err.code === "no-token") {
      return res.status(403).json({ error: "Not authorized" });
    }
    return res.status(500).json({ error: err.message });
  }
}

