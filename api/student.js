// api/student.js - Combined student endpoints
import { db, adminLib } from "./_firebase.js";
import { verifyStudent } from "./_authStudent.js";
import { setCORSHeaders } from "./_cors.js";
import { auth } from "./_firebase.js";

export default async function handler(req, res) {
  setCORSHeaders(req, res);
  
  if (req.method === "OPTIONS") return res.status(204).end();

  const { action } = req.query;

  try {
    // Register
    if (action === "register" && req.method === "POST") {
      const { email, password, name, interests } = req.body;
      if (!email || !password || !name) {
        return res.status(400).json({ error: "Missing required fields: email, password, name" });
      }
      
      const userRecord = await auth.createUser({ email, password, displayName: name, emailVerified: false });
      const uid = userRecord.uid;
      
      const userData = {
        uid, email, name, role: "student", interests: interests || [],
        isProfileComplete: false,
        createdAt: adminLib.firestore.FieldValue.serverTimestamp(),
        lastLogin: adminLib.firestore.FieldValue.serverTimestamp(),
      };
      
      await db.collection("users").doc(uid).set(userData);
      return res.status(201).json({ success: true, message: "Student registered", user: { uid, email, name, role: "student" } });
    }

    // Get/Update profile
    if (action === "profile") {
      const { uid, user } = await verifyStudent(req);
      
      if (req.method === "GET") {
        const userDoc = await db.collection("users").doc(uid).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        const profile = {
          uid, email: userData.email || user.email || "", name: userData.name || "",
          interests: userData.interests || [], avatar: userData.avatar || "",
          isProfileComplete: userData.isProfileComplete || false, createdAt: userData.createdAt,
        };
        return res.status(200).json({ success: true, profile });
      }
      
      if (req.method === "PUT") {
        const { name, interests, avatar } = req.body;
        const updates = { updatedAt: adminLib.firestore.FieldValue.serverTimestamp() };
        if (name !== undefined) updates.name = name;
        if (interests !== undefined) updates.interests = Array.isArray(interests) ? interests : [];
        if (avatar !== undefined) updates.avatar = avatar || "";
        if (name || interests || avatar) updates.isProfileComplete = true;
        
        await db.collection("users").doc(uid).set(updates, { merge: true });
        return res.status(200).json({ success: true, message: "Profile updated", profile: { uid, ...updates } });
      }
    }

    // Enroll in class
    if (action === "enroll" && req.method === "POST") {
      const { uid, user } = await verifyStudent(req);
      const { classId } = req.body;
      if (!classId) return res.status(400).json({ error: "classId required" });
      
      const classDoc = await db.collection("classes").doc(classId).get();
      if (!classDoc.exists) return res.status(404).json({ error: "Class not found" });
      
      const classData = classDoc.data();
      if (classData.approvalStatus !== "approved") return res.status(400).json({ error: "Class not available" });
      
      const existingEnrollment = await db.collection("enrollments")
        .where("classId", "==", classId).where("studentUid", "==", uid).get();
      if (!existingEnrollment.empty) return res.status(400).json({ error: "Already enrolled" });
      
      const enrollmentsSnapshot = await db.collection("enrollments").where("classId", "==", classId).get();
      if (enrollmentsSnapshot.size >= classData.maxLearners) return res.status(400).json({ error: "Class is full" });
      
      const enrollmentData = {
        classId, studentUid: uid, studentEmail: user.email || "", studentName: user.name || "",
        status: "enrolled", price: classData.price,
        createdAt: adminLib.firestore.FieldValue.serverTimestamp(),
      };
      
      const enrollmentRef = await db.collection("enrollments").add(enrollmentData);
      return res.status(201).json({
        success: true, message: "Enrolled successfully", enrollmentId: enrollmentRef.id,
        enrollment: { id: enrollmentRef.id, ...enrollmentData },
        class: { id: classId, title: classData.title, price: classData.price },
      });
    }

    // Get enrollments
    if (action === "enrollments" && req.method === "GET") {
      const { uid } = await verifyStudent(req);
      const { status } = req.query;
      
      let query = db.collection("enrollments").where("studentUid", "==", uid);
      if (status) query = query.where("status", "==", status);
      
      const snapshot = await query.get();
      const enrollments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const enrollmentsWithClasses = await Promise.all(
        enrollments.map(async (enrollment) => {
          const classDoc = await db.collection("classes").doc(enrollment.classId).get();
          const classData = classDoc.exists ? { id: classDoc.id, ...classDoc.data() } : null;
          return { ...enrollment, class: classData };
        })
      );
      
      enrollmentsWithClasses.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt?._seconds || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt?._seconds || 0;
        return bTime - aTime;
      });
      
      return res.status(200).json({ success: true, enrollments: enrollmentsWithClasses, count: enrollmentsWithClasses.length });
    }

    // Get dashboard
    if (action === "dashboard" && req.method === "GET") {
      const { uid } = await verifyStudent(req);
      
      const enrollmentsSnapshot = await db.collection("enrollments").where("studentUid", "==", uid).get();
      const enrollments = enrollmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const now = new Date();
      const upcoming = [], past = [], pending = [];
      
      for (const enrollment of enrollments) {
        const classDoc = await db.collection("classes").doc(enrollment.classId).get();
        if (!classDoc.exists) continue;
        
        const classData = { id: classDoc.id, ...classDoc.data() };
        const startTime = classData.startTime?.toDate?.() || new Date(classData.startTime);
        const enrollmentWithClass = {
          ...enrollment, class: classData, meetLink: classData.meetLink || "", status: classData.status || "scheduled",
        };
        
        if (enrollment.status === "paid" && startTime > now) {
          upcoming.push(enrollmentWithClass);
        } else if (startTime <= now) {
          past.push(enrollmentWithClass);
        } else {
          pending.push(enrollmentWithClass);
        }
      }
      
      upcoming.sort((a, b) => {
        const aTime = a.class.startTime?.toDate?.() || new Date(a.class.startTime);
        const bTime = b.class.startTime?.toDate?.() || new Date(b.class.startTime);
        return aTime - bTime;
      });
      
      past.sort((a, b) => {
        const aTime = a.class.startTime?.toDate?.() || new Date(a.class.startTime);
        const bTime = b.class.startTime?.toDate?.() || new Date(b.class.startTime);
        return bTime - aTime;
      });
      
      return res.status(200).json({
        success: true,
        dashboard: {
          upcomingClasses: upcoming, pastClasses: past, pendingPayments: pending,
          stats: {
            totalEnrollments: enrollments.length, upcomingCount: upcoming.length,
            completedCount: past.length, pendingPaymentCount: pending.length,
          },
        },
      });
    }

    // Get Meet link
    if (action === "meet-link" && req.method === "GET") {
      const { uid } = await verifyStudent(req);
      const { classId } = req.query;
      if (!classId) return res.status(400).json({ error: "classId required" });
      
      const enrollmentSnapshot = await db.collection("enrollments")
        .where("classId", "==", classId).where("studentUid", "==", uid).where("status", "==", "paid").get();
      if (enrollmentSnapshot.empty) return res.status(403).json({ error: "Not enrolled or payment not completed" });
      
      const classDoc = await db.collection("classes").doc(classId).get();
      if (!classDoc.exists) return res.status(404).json({ error: "Class not found" });
      
      const classData = classDoc.data();
      const startTime = classData.startTime?.toDate?.() || new Date(classData.startTime);
      const now = new Date();
      const timeUntilStart = startTime - now;
      
      if (classData.status !== "live" && timeUntilStart > 15 * 60 * 1000) {
        return res.status(400).json({
          error: "Class has not started yet", startTime: startTime.toISOString(),
          timeUntilStart: Math.floor(timeUntilStart / 1000 / 60),
        });
      }
      
      return res.status(200).json({
        success: true, meetLink: classData.meetLink || "",
        class: { id: classId, title: classData.title, status: classData.status, startTime: startTime.toISOString() },
      });
    }

    // Submit review
    if (action === "submit-review" && req.method === "POST") {
      const { uid, user } = await verifyStudent(req);
      const { classId, rating, comment } = req.body;
      if (!classId || !rating) return res.status(400).json({ error: "classId and rating required" });
      if (rating < 1 || rating > 5) return res.status(400).json({ error: "Rating must be 1-5" });
      
      const enrollmentSnapshot = await db.collection("enrollments")
        .where("classId", "==", classId).where("studentUid", "==", uid).where("status", "==", "paid").get();
      if (enrollmentSnapshot.empty) return res.status(403).json({ error: "Must be enrolled and paid" });
      
      const existingReview = await db.collection("reviews")
        .where("classId", "==", classId).where("studentUid", "==", uid).get();
      if (!existingReview.empty) return res.status(400).json({ error: "Already reviewed" });
      
      const classDoc = await db.collection("classes").doc(classId).get();
      if (!classDoc.exists) return res.status(404).json({ error: "Class not found" });
      const classData = classDoc.data();
      
      const reviewData = {
        classId, creatorUid: classData.creatorUid, studentUid: uid,
        studentName: user.name || "", studentEmail: user.email || "",
        rating: parseInt(rating), comment: comment || "",
        createdAt: adminLib.firestore.FieldValue.serverTimestamp(),
      };
      
      const reviewRef = await db.collection("reviews").add(reviewData);
      return res.status(201).json({ success: true, message: "Review submitted", review: { id: reviewRef.id, ...reviewData } });
    }

    return res.status(404).json({ error: "Action not found" });
  } catch (err) {
    console.error("student error:", err);
    if (err.code === "not-authorized" || err.code === "no-token") {
      return res.status(403).json({ error: "Not authorized" });
    }
    if (err.code === "auth/email-already-exists") {
      return res.status(400).json({ error: "Email already registered" });
    }
    return res.status(500).json({ error: err.message });
  }
}

