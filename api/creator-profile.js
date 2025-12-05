// api/creator-profile.js - Get/Update creator profile
import { db, adminLib } from "./_firebase.js";
import { verifyCreator } from "./_authCreator.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,PUT,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const { uid, user } = await verifyCreator(req);

    if (req.method === "GET") {
      // Get creator profile
      const creatorDoc = await db.collection("creators").doc(uid).get();
      const userDoc = await db.collection("users").doc(uid).get();

      const creatorData = creatorDoc.exists ? creatorDoc.data() : {};
      const userData = userDoc.exists ? userDoc.data() : {};

      const profile = {
        uid,
        email: userData.email || user.email || "",
        name: userData.name || creatorData.name || "",
        bio: creatorData.bio || "",
        expertise: creatorData.expertise || [],
        socialHandles: creatorData.socialHandles || {},
        introVideoUrl: creatorData.introVideoUrl || "",
        profileImageUrl: creatorData.profileImageUrl || "",
        approved: creatorData.approved || false,
        createdAt: creatorData.createdAt || userData.createdAt,
      };

      return res.status(200).json({ success: true, profile });
    }

    if (req.method === "PUT") {
      // Update creator profile
      const {
        name,
        bio,
        expertise,
        socialHandles,
        introVideoUrl,
        profileImageUrl,
      } = req.body;

      const updates = {
        updatedAt: adminLib.firestore.FieldValue.serverTimestamp(),
      };

      if (name !== undefined) updates.name = name;
      if (bio !== undefined) updates.bio = bio;
      if (expertise !== undefined) updates.expertise = Array.isArray(expertise) ? expertise : [];
      if (socialHandles !== undefined) updates.socialHandles = socialHandles || {};
      if (introVideoUrl !== undefined) updates.introVideoUrl = introVideoUrl || "";
      if (profileImageUrl !== undefined) updates.profileImageUrl = profileImageUrl || "";

      // Update creators collection
      await db.collection("creators").doc(uid).set(updates, { merge: true });

      // Also update users collection if name changed
      if (name !== undefined) {
        await db.collection("users").doc(uid).set({ name }, { merge: true });
      }

      return res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        profile: { uid, ...updates },
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("creator-profile error:", err);
    if (err.code === "not-authorized" || err.code === "no-token") {
      return res.status(403).json({ error: "Not authorized" });
    }
    return res.status(500).json({ error: err.message });
  }
}

