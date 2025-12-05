// api/student-profile.js - Get/Update student profile
import { db, adminLib } from "./_firebase.js";
import { verifyStudent } from "./_authStudent.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,PUT,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const { uid, user } = await verifyStudent(req);

    if (req.method === "GET") {
      const userDoc = await db.collection("users").doc(uid).get();
      const userData = userDoc.exists ? userDoc.data() : {};

      const profile = {
        uid,
        email: userData.email || user.email || "",
        name: userData.name || "",
        interests: userData.interests || [],
        avatar: userData.avatar || "",
        isProfileComplete: userData.isProfileComplete || false,
        createdAt: userData.createdAt,
      };

      return res.status(200).json({ success: true, profile });
    }

    if (req.method === "PUT") {
      const { name, interests, avatar } = req.body;

      const updates = {
        updatedAt: adminLib.firestore.FieldValue.serverTimestamp(),
      };

      if (name !== undefined) updates.name = name;
      if (interests !== undefined) updates.interests = Array.isArray(interests) ? interests : [];
      if (avatar !== undefined) updates.avatar = avatar || "";
      if (name || interests || avatar) {
        updates.isProfileComplete = true;
      }

      await db.collection("users").doc(uid).set(updates, { merge: true });

      return res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        profile: { uid, ...updates },
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("student-profile error:", err);
    if (err.code === "not-authorized" || err.code === "no-token") {
      return res.status(403).json({ error: "Not authorized" });
    }
    return res.status(500).json({ error: err.message });
  }
}

