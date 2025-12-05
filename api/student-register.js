// api/student-register.js - Student registration
import { auth, db, adminLib } from "./_firebase.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { email, password, name, interests } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: "Missing required fields: email, password, name" });
    }

    // Create Firebase Auth user
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
      emailVerified: false,
    });

    const uid = userRecord.uid;

    // Create user document in Firestore
    const userData = {
      uid,
      email,
      name,
      role: "student",
      interests: interests || [],
      isProfileComplete: false,
      createdAt: adminLib.firestore.FieldValue.serverTimestamp(),
      lastLogin: adminLib.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection("users").doc(uid).set(userData);

    return res.status(201).json({
      success: true,
      message: "Student registered successfully",
      user: { uid, email, name, role: "student" },
    });
  } catch (err) {
    console.error("student-register error:", err);
    if (err.code === "auth/email-already-exists") {
      return res.status(400).json({ error: "Email already registered" });
    }
    return res.status(500).json({ error: err.message });
  }
}

