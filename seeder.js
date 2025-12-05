// seeder.js - Complete Firestore seeder with all collections
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

// Convert escaped \n to real newlines if needed
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
    console.log("🌱 Starting complete Firestore seed...\n");

    // ============================================
    // 1. USERS COLLECTION
    // ============================================
    console.log("📝 Creating users...");

    // Admin user
    const adminUid = process.env.SAMPLE_ADMIN_UID || "admin_001";
    const adminUser = {
      uid: adminUid,
      email: "admin@zefrix.com",
      name: "Admin User",
      role: "admin",
      isProfileComplete: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: admin.firestore.FieldValue.serverTimestamp(),
    };
    await db.collection("users").doc(adminUid).set(adminUser, { merge: true });
    console.log(`  ✅ Created admin user: ${adminUid}`);

    // Creator users
    const creatorUids = ["creator_001", "creator_002", "creator_003"];
    const creatorsData = [
      {
        uid: "creator_001",
        email: "aisha@zefrix.com",
        name: "Aisha Khan",
        role: "creator",
        interests: ["Design", "Art"],
        avatar: "https://i.pravatar.cc/150?img=1",
        isProfileComplete: true,
      },
      {
        uid: "creator_002",
        email: "bilal@zefrix.com",
        name: "Bilal Ahmed",
        role: "creator",
        interests: ["Coding", "Web Development"],
        avatar: "https://i.pravatar.cc/150?img=2",
        isProfileComplete: true,
      },
      {
        uid: "creator_003",
        email: "chen@zefrix.com",
        name: "Chen Li",
        role: "creator",
        interests: ["Calligraphy", "Art"],
        avatar: "https://i.pravatar.cc/150?img=3",
        isProfileComplete: true,
      },
    ];

    for (const creator of creatorsData) {
      const userData = {
        ...creator,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastLogin: admin.firestore.FieldValue.serverTimestamp(),
      };
      await db.collection("users").doc(creator.uid).set(userData, { merge: true });
      console.log(`  ✅ Created creator user: ${creator.uid}`);
    }

    // Student users
    const studentUids = ["student_001", "student_002", "student_003", "student_004"];
    const studentsData = [
      {
        uid: "student_001",
        email: "student1@test.com",
        name: "Rahul Sharma",
        role: "student",
        interests: ["Design", "Music"],
        avatar: "https://i.pravatar.cc/150?img=4",
        isProfileComplete: true,
      },
      {
        uid: "student_002",
        email: "student2@test.com",
        name: "Priya Patel",
        role: "student",
        interests: ["Coding", "Design"],
        avatar: "https://i.pravatar.cc/150?img=5",
        isProfileComplete: true,
      },
      {
        uid: "student_003",
        email: "student3@test.com",
        name: "Arjun Singh",
        role: "student",
        interests: ["Music", "Art"],
        avatar: "https://i.pravatar.cc/150?img=6",
        isProfileComplete: false,
      },
      {
        uid: "student_004",
        email: "student4@test.com",
        name: "Sneha Reddy",
        role: "student",
        interests: ["Design", "Photography"],
        avatar: "https://i.pravatar.cc/150?img=7",
        isProfileComplete: true,
      },
    ];

    for (const student of studentsData) {
      const userData = {
        ...student,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastLogin: admin.firestore.FieldValue.serverTimestamp(),
      };
      await db.collection("users").doc(student.uid).set(userData, { merge: true });
      console.log(`  ✅ Created student user: ${student.uid}`);
    }

    // Create Firebase Auth users if enabled
    if (createAuthUsers) {
      console.log("\n🔐 Creating Firebase Auth users...");
      const allUsers = [adminUser, ...creatorsData, ...studentsData];
      for (const user of allUsers) {
        try {
          await auth.getUser(user.uid);
          console.log(`  ⏭️  Auth user ${user.uid} already exists`);
        } catch (e) {
          await auth.createUser({
            uid: user.uid,
            email: user.email,
            password: defaultPassword,
            displayName: user.name,
            emailVerified: false,
          });
          if (user.role === "admin") {
            await auth.setCustomUserClaims(user.uid, { role: "admin" });
          }
          console.log(`  ✅ Created auth user ${user.uid} (password: ${defaultPassword})`);
        }
      }
    }

    // ============================================
    // 2. CREATORS COLLECTION
    // ============================================
    console.log("\n👨‍🎨 Creating creators...");

    const creators = [
      {
        uid: "creator_001",
        name: "Aisha Khan",
        email: "aisha@zefrix.com",
        bio: "Professional painter and illustrator with 10+ years of experience. Specialized in watercolor and digital art.",
        expertise: ["Watercolor", "Digital Art", "Illustration"],
        socialHandles: {
          instagram: "@aishakhan_art",
          twitter: "@aishakhan",
          linkedin: "aisha-khan-art",
        },
        introVideoUrl: "https://example.com/videos/aisha-intro.mp4",
        profileImageUrl: "https://i.pravatar.cc/300?img=1",
        approved: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {
        uid: "creator_002",
        name: "Bilal Ahmed",
        email: "bilal@zefrix.com",
        bio: "Full-stack developer and coding instructor. Teaching React, Node.js, and modern web development.",
        expertise: ["React", "Node.js", "Web Development", "JavaScript"],
        socialHandles: {
          instagram: "@bilal_dev",
          twitter: "@bilaldev",
          linkedin: "bilal-ahmed-dev",
        },
        introVideoUrl: "https://example.com/videos/bilal-intro.mp4",
        profileImageUrl: "https://i.pravatar.cc/300?img=2",
        approved: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {
        uid: "creator_003",
        name: "Chen Li",
        email: "chen@zefrix.com",
        bio: "Master calligrapher specializing in Chinese and modern calligraphy styles.",
        expertise: ["Calligraphy", "Chinese Art", "Typography"],
        socialHandles: {
          instagram: "@chen_calligraphy",
          twitter: "@chenli",
          linkedin: "chen-li-calligraphy",
        },
        introVideoUrl: "https://example.com/videos/chen-intro.mp4",
        profileImageUrl: "https://i.pravatar.cc/300?img=3",
        approved: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    ];

    for (const creator of creators) {
      await db.collection("creators").doc(creator.uid).set(creator, { merge: true });
      console.log(`  ✅ Created creator: ${creator.name}`);
    }

    // ============================================
    // 3. CLASSES COLLECTION
    // ============================================
    console.log("\n📚 Creating classes...");

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;

    const classes = [
      // Pending classes
      {
        title: "Watercolor Basics for Beginners",
        description: "Learn the fundamentals of watercolor painting. Perfect for absolute beginners!",
        category: "Design",
        subCategory: "Watercolor",
        type: "one-time",
        creatorUid: "creator_001",
        creatorEmail: "aisha@zefrix.com",
        creatorName: "Aisha Khan",
        startTime: admin.firestore.Timestamp.fromDate(new Date(now + 3 * oneDay)),
        endTime: admin.firestore.Timestamp.fromDate(new Date(now + 3 * oneDay + 2 * 60 * 60 * 1000)),
        maxLearners: 15,
        price: 999,
        thumbnailUrl: "https://images.unsplash.com/photo-1541961017774-22349e4a1262",
        bannerUrl: "https://images.unsplash.com/photo-1541961017774-22349e4a1262",
        sessions: [],
        approvalStatus: "pending",
        status: "scheduled",
        meetLink: "",
        recordingUrl: "",
        summary: "",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {
        title: "React Fundamentals Workshop",
        description: "Master React from scratch. Build real projects and learn best practices.",
        category: "Coding",
        subCategory: "React",
        type: "batch",
        creatorUid: "creator_002",
        creatorEmail: "bilal@zefrix.com",
        creatorName: "Bilal Ahmed",
        startTime: admin.firestore.Timestamp.fromDate(new Date(now + 5 * oneDay)),
        endTime: admin.firestore.Timestamp.fromDate(new Date(now + 5 * oneDay + 2 * 60 * 60 * 1000)),
        maxLearners: 20,
        price: 2499,
        thumbnailUrl: "https://images.unsplash.com/photo-1633356122544-f134324a6cee",
        bannerUrl: "https://images.unsplash.com/photo-1633356122544-f134324a6cee",
        sessions: [
          { date: new Date(now + 5 * oneDay).toISOString(), time: "10:00", duration: 120 },
          { date: new Date(now + 7 * oneDay).toISOString(), time: "10:00", duration: 120 },
          { date: new Date(now + 9 * oneDay).toISOString(), time: "10:00", duration: 120 },
          { date: new Date(now + 11 * oneDay).toISOString(), time: "10:00", duration: 120 },
        ],
        approvalStatus: "pending",
        status: "scheduled",
        meetLink: "",
        recordingUrl: "",
        summary: "",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      // Approved classes
      {
        title: "Modern Calligraphy Masterclass",
        description: "Learn beautiful modern calligraphy techniques. All materials included!",
        category: "Design",
        subCategory: "Calligraphy",
        type: "one-time",
        creatorUid: "creator_003",
        creatorEmail: "chen@zefrix.com",
        creatorName: "Chen Li",
        startTime: admin.firestore.Timestamp.fromDate(new Date(now + 7 * oneDay)),
        endTime: admin.firestore.Timestamp.fromDate(new Date(now + 7 * oneDay + 3 * 60 * 60 * 1000)),
        maxLearners: 12,
        price: 1499,
        thumbnailUrl: "https://images.unsplash.com/photo-1493612276216-ee3925520721",
        bannerUrl: "https://images.unsplash.com/photo-1493612276216-ee3925520721",
        sessions: [],
        approvalStatus: "approved",
        status: "scheduled",
        meetLink: "https://meet.google.com/abc-defg-hij",
        recordingUrl: "",
        summary: "",
        approvedAt: admin.firestore.Timestamp.fromDate(new Date(now - 2 * oneDay)),
        rejectedAt: null,
        rejectionReason: null,
        startedAt: null,
        endedAt: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {
        title: "Advanced CSS & Layouts",
        description: "Deep dive into CSS Grid, Flexbox, and modern layout techniques.",
        category: "Coding",
        subCategory: "CSS",
        type: "one-time",
        creatorUid: "creator_002",
        creatorEmail: "bilal@zefrix.com",
        creatorName: "Bilal Ahmed",
        startTime: admin.firestore.Timestamp.fromDate(new Date(now + 10 * oneDay)),
        endTime: admin.firestore.Timestamp.fromDate(new Date(now + 10 * oneDay + 2 * 60 * 60 * 1000)),
        maxLearners: 25,
        price: 799,
        thumbnailUrl: "https://images.unsplash.com/photo-1507721999472-8ed4421c4af2",
        bannerUrl: "https://images.unsplash.com/photo-1507721999472-8ed4421c4af2",
        sessions: [],
        approvalStatus: "approved",
        status: "scheduled",
        meetLink: "https://meet.google.com/xyz-uvwx-rst",
        recordingUrl: "",
        summary: "",
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        rejectedAt: null,
        rejectionReason: null,
        startedAt: null,
        endedAt: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {
        title: "Portrait Sketching Workshop",
        description: "Learn to sketch beautiful portraits with pencil and charcoal.",
        category: "Design",
        subCategory: "Sketching",
        type: "one-time",
        creatorUid: "creator_001",
        creatorEmail: "aisha@zefrix.com",
        creatorName: "Aisha Khan",
        startTime: admin.firestore.Timestamp.fromDate(new Date(now + 14 * oneDay)),
        endTime: admin.firestore.Timestamp.fromDate(new Date(now + 14 * oneDay + 4 * 60 * 60 * 1000)),
        maxLearners: 10,
        price: 1299,
        thumbnailUrl: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0",
        bannerUrl: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0",
        sessions: [],
        approvalStatus: "approved",
        status: "scheduled",
        meetLink: "https://meet.google.com/mno-pqrs-tuv",
        recordingUrl: "",
        summary: "",
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        rejectedAt: null,
        rejectionReason: null,
        startedAt: null,
        endedAt: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      // Rejected class
      {
        title: "Figma UI Design Crash Course",
        description: "Quick crash course on Figma for UI design.",
        category: "Design",
        subCategory: "UI Design",
        type: "one-time",
        creatorUid: "creator_001",
        creatorEmail: "aisha@zefrix.com",
        creatorName: "Aisha Khan",
        startTime: admin.firestore.Timestamp.fromDate(new Date(now + 20 * oneDay)),
        endTime: admin.firestore.Timestamp.fromDate(new Date(now + 20 * oneDay + 2 * 60 * 60 * 1000)),
        maxLearners: 30,
        price: 599,
        thumbnailUrl: "https://images.unsplash.com/photo-1561070791-2526d30994b5",
        bannerUrl: "https://images.unsplash.com/photo-1561070791-2526d30994b5",
        sessions: [],
        approvalStatus: "rejected",
        status: "scheduled",
        meetLink: "",
        recordingUrl: "",
        summary: "",
        approvedAt: null,
        rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
        rejectionReason: "Content quality doesn't meet standards",
        startedAt: null,
        endedAt: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    ];

    const createdClassIds = [];
    for (const cls of classes) {
      const classId = uuidv4();
      createdClassIds.push(classId);
      await db.collection("classes").doc(classId).set({
        id: classId,
        ...cls,
      });
      console.log(`  ✅ Created class: ${cls.title} (${cls.approvalStatus})`);
    }

    // ============================================
    // 4. ENROLLMENTS COLLECTION
    // ============================================
    console.log("\n🎫 Creating enrollments...");

    const enrollments = [
      {
        id: uuidv4(),
        classId: createdClassIds[2], // Modern Calligraphy (approved)
        studentUid: "student_001",
        studentEmail: "student1@test.com",
        studentName: "Rahul Sharma",
        status: "paid",
        price: 1499,
        paymentId: "pay_test_001",
        paymentStatus: "captured",
        paidAt: admin.firestore.Timestamp.fromDate(new Date(now - 1 * oneDay)),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {
        id: uuidv4(),
        classId: createdClassIds[2], // Modern Calligraphy (approved)
        studentUid: "student_002",
        studentEmail: "student2@test.com",
        studentName: "Priya Patel",
        status: "paid",
        price: 1499,
        paymentId: "pay_test_002",
        paymentStatus: "captured",
        paidAt: admin.firestore.Timestamp.fromDate(new Date(now - 1 * oneDay)),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {
        id: uuidv4(),
        classId: createdClassIds[3], // Advanced CSS (approved)
        studentUid: "student_001",
        studentEmail: "student1@test.com",
        studentName: "Rahul Sharma",
        status: "enrolled",
        price: 799,
        paymentId: null,
        paymentStatus: null,
        paidAt: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {
        id: uuidv4(),
        classId: createdClassIds[4], // Portrait Sketching (approved)
        studentUid: "student_004",
        studentEmail: "student4@test.com",
        studentName: "Sneha Reddy",
        status: "paid",
        price: 1299,
        paymentId: "pay_test_003",
        paymentStatus: "captured",
        paidAt: admin.firestore.Timestamp.fromDate(new Date(now - 2 * oneDay)),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    ];

    for (const enrollment of enrollments) {
      await db.collection("enrollments").doc(enrollment.id).set(enrollment);
      console.log(`  ✅ Created enrollment: ${enrollment.studentName} → Class ${enrollment.classId.substring(0, 8)}...`);
    }

    // ============================================
    // 5. REVIEWS COLLECTION (Optional for MVP)
    // ============================================
    console.log("\n⭐ Creating reviews (optional)...");

    const reviews = [
      {
        classId: createdClassIds[2], // Modern Calligraphy
        creatorUid: "creator_003",
        studentUid: "student_001",
        studentName: "Rahul Sharma",
        studentEmail: "student1@test.com",
        rating: 5,
        comment: "Amazing class! Chen is a fantastic teacher. Learned so much!",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {
        classId: createdClassIds[2], // Modern Calligraphy
        creatorUid: "creator_003",
        studentUid: "student_002",
        studentName: "Priya Patel",
        studentEmail: "student2@test.com",
        rating: 4,
        comment: "Great workshop, very detailed explanations.",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    ];

    for (const review of reviews) {
      const reviewId = uuidv4();
      await db.collection("reviews").doc(reviewId).set(review);
      console.log(`  ✅ Created review: ${review.studentName} (${review.rating}⭐)`);
    }

    // ============================================
    // 6. PAYOUTS COLLECTION (Optional)
    // ============================================
    console.log("\n💰 Creating payouts (optional)...");

    const payouts = [
      {
        creatorUid: "creator_003",
        creatorName: "Chen Li",
        amount: 2998, // 2 enrollments × 1499
        status: "pending",
        period: "2024-01",
        enrollments: [enrollments[0].id, enrollments[1].id],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    ];

    for (const payout of payouts) {
      const payoutId = uuidv4();
      await db.collection("payouts").doc(payoutId).set(payout);
      console.log(`  ✅ Created payout: ${payout.creatorName} - ₹${payout.amount}`);
    }

    // ============================================
    // SUMMARY
    // ============================================
    console.log("\n" + "=".repeat(50));
    console.log("✅ Seeding completed successfully!");
    console.log("=".repeat(50));
    console.log("\n📊 Summary:");
    console.log(`  👥 Users: ${1 + creatorsData.length + studentsData.length} (1 admin, ${creatorsData.length} creators, ${studentsData.length} students)`);
    console.log(`  👨‍🎨 Creators: ${creators.length}`);
    console.log(`  📚 Classes: ${classes.length} (${classes.filter(c => c.approvalStatus === "pending").length} pending, ${classes.filter(c => c.approvalStatus === "approved").length} approved, ${classes.filter(c => c.approvalStatus === "rejected").length} rejected)`);
    console.log(`  🎫 Enrollments: ${enrollments.length}`);
    console.log(`  ⭐ Reviews: ${reviews.length}`);
    console.log(`  💰 Payouts: ${payouts.length}`);
    console.log("\n🔑 Test Credentials:");
    console.log(`  Admin: admin@zefrix.com / ${defaultPassword}`);
    console.log(`  Creator: aisha@zefrix.com / ${defaultPassword}`);
    console.log(`  Student: student1@test.com / ${defaultPassword}`);
    console.log("\n" + "=".repeat(50));

    process.exit(0);
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  }
}

seed();
