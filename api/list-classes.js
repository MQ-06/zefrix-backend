import { db } from './_firebase.js';

export default async function handler(req, res) {
  try {
    const snapshot = await db.collection("classes").get();
    const classes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    res.status(200).json({ success: true, classes });
  } catch (error) {
    console.error("Error fetching classes:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}
