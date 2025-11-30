// seeder.js
import admin from "firebase-admin";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY in env.");
  process.exit(1);
}

// convert escaped \n to real newlines if needed
if (privateKey.includes("\\n")) privateKey = privateKey.replace(/\\n/g, "\n");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const db = admin.firestore();
const auth = admin.auth();
const createAuthUsers = (process.env.CREATE_AUTH_USERS || "false").toLowerCase() === "true";
const defaultPassword = process.env.DEFAULT_TEST_PASSWORD || "Test1234!";

async function seed() {
  try {
    console.log("Starting seed...");

    // --- 1) Create an admin user doc (use an existing uid or new one) ---
    const adminUid = process.env.SAMPLE_ADMIN_UID || "EiDax8hCp4W5EzHXJA8MvtBAhM63"; // change if you want
    const adminUserDoc = {
      uid: adminUid,
      email: "kartik@zefrix.com",
      name: "Kartik",
      role: "admin",
      isProfileComplete: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection("users").doc(adminUid).set(adminUserDoc, { merge: true });
    console.log(`Wrote users/${adminUid}`);

    if (createAuthUsers) {
      try {
        await auth.getUser(adminUid);
        console.log(`Auth user ${adminUid} already exists — skipping create.`);
      } catch (e) {
        await auth.createUser({
          uid: adminUid,
          email: "kartik@zefrix.com",
          emailVerified: false,
          password: defaultPassword,
          displayName: "Kartik",
        });
        console.log(`Created Firebase Auth user ${adminUid} (password: ${defaultPassword})`);
        // Optionally set a custom claim - comment if not desired
        await auth.setCustomUserClaims(adminUid, { role: "admin" });
        console.log("Set custom claim role=admin for the auth user.");
      }
    }

    // --- 2) Create creators ---
    const creators = [
      { uid: "creator_1", name: "Aisha Khan", email: "aisha@test.com", bio: "Painter & illustrator", approved: true },
      { uid: "creator_2", name: "Bilal Ahmed", email: "bilal@test.com", bio: "Web dev & teacher", approved: false },
      { uid: "creator_3", name: "Chen Li", email: "chen@test.com", bio: "Calligraphy", approved: true },
    ];

    for (const c of creators) {
      await db.collection("creators").doc(c.uid).set({
        uid: c.uid,
        name: c.name,
        email: c.email,
        bio: c.bio,
        approved: c.approved,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`Wrote creators/${c.uid}`);
      if (createAuthUsers) {
        try {
          await auth.getUser(c.uid);
          console.log(`Auth user ${c.uid} already exists — skipping create.`);
        } catch {
          await auth.createUser({
            uid: c.uid,
            email: c.email,
            password: defaultPassword,
            displayName: c.name,
          });
          console.log(`Created auth user ${c.uid}`);
        }
      }
    }

    // --- 3) Create classes (mix of pending, approved, rejected) ---
    const now = Date.now();
    const classes = [
      { title: "Watercolor Basics", creatorUid: "creator_1", approvalStatus: "pending", description: "Intro to watercolor" },
      { title: "React for Beginners", creatorUid: "creator_2", approvalStatus: "pending", description: "Start with React" },
      { title: "Modern Calligraphy", creatorUid: "creator_3", approvalStatus: "approved", description: "Letters & strokes" },
      { title: "Advanced CSS", creatorUid: "creator_2", approvalStatus: "rejected", description: "Layouts and grids" },
      { title: "Portrait Sketching", creatorUid: "creator_1", approvalStatus: "pending", description: "Sketch people" },
      { title: "Figma UI Workshop", creatorUid: "creator_3", approvalStatus: "approved", description: "Design fast" },
    ];

    const createdClassIds = [];
    for (const cls of classes) {
      const docId = uuidv4();
      createdClassIds.push(docId);
      await db.collection("classes").doc(docId).set({
        id: docId,
        title: cls.title,
        description: cls.description,
        creatorUid: cls.creatorUid,
        approvalStatus: cls.approvalStatus,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        // sample schedule
        startTime: new Date(now + Math.floor(Math.random() * 7) * 24 * 3600 * 1000),
        seats: Math.floor(Math.random() * 40) + 5,
        price: [0, 499, 999][Math.floor(Math.random() * 3)],
      });
      console.log(`Wrote classes/${docId} (${cls.title})`);
    }

    // --- 4) Create sample enrollments ---
    const enrollments = [
      { studentEmail: "student1@test.com", classId: createdClassIds[0], status: "enrolled" },
      { studentEmail: "student2@test.com", classId: createdClassIds[0], status: "enrolled" },
      { studentEmail: "student3@test.com", classId: createdClassIds[2], status: "completed" },
      { studentEmail: "student4@test.com", classId: createdClassIds[5], status: "enrolled" },
    ];

    for (const e of enrollments) {
      const eid = uuidv4();
      await db.collection("enrollments").doc(eid).set({
        id: eid,
        classId: e.classId,
        studentEmail: e.studentEmail,
        status: e.status,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`Wrote enrollments/${eid}`);
    }

    console.log("Seeding completed successfully!");
    console.log("Summary:");
    console.log(` - Admin user written users/${adminUid}`);
    console.log(` - ${creators.length} creators written`);
    console.log(` - ${classes.length} classes written (IDs: ${createdClassIds.join(", ")})`);
    console.log(` - ${enrollments.length} enrollments written`);
    console.log("");
    console.log("If you enabled CREATE_AUTH_USERS=true, Auth users were created with default password:", defaultPassword);

    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  }
}

seed();
