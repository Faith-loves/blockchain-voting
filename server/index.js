require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const rateLimit = require("express-rate-limit");
const { z } = require("zod");
const { nanoid } = require("nanoid");

const User = require("./models/User");
const Election = require("./models/Election");
const Vote = require("./models/Vote");
const Feedback = require("./models/Feedback");

const auth = require("./middleware/auth");
const adminRouter = require("./middleware/admin");

const currentElectionSeed = require("./seed/currentElection");
const { makeHash, makeLegacyHash, storeReceiptOnChain } = require("./chain");

const app = express();

const isProd = process.env.NODE_ENV === "production";
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

app.use(helmet());
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || origin === CLIENT_ORIGIN) return cb(null, true);
      return cb(new Error("CORS blocked"));
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
const clientDistPath = path.resolve(__dirname, "../client/dist");
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
}
app.use((req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  const openPaths = new Set(["/api/auth/login", "/api/auth/register", "/api/auth/logout"]);
  if (openPaths.has(req.path)) return next();

  const csrfCookie = req.cookies?.csrf_token || "";
  const csrfHeader = req.headers["x-csrf-token"] || "";
  if (!csrfCookie || csrfCookie !== csrfHeader) {
    return res.status(403).json({ ok: false, message: "CSRF token invalid" });
  }
  return next();
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});
const submitLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/votes/submit", submitLimiter);
app.use("/api/feedback", submitLimiter);

// admin routes (only once)
app.use("/api/admin", adminRouter);

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;

if (!MONGO_URI) {
  console.error("❌ Missing MONGO_URI");
  process.exit(1);
}
if (!JWT_SECRET) {
  console.error("❌ Missing JWT_SECRET");
  process.exit(1);
}

if (!process.env.RECEIPT_SECRET) {
  console.error("Missing RECEIPT_SECRET");
  process.exit(1);
}

const registerSchema = z.object({
  email: z.string().email().max(120),
  matric: z.string().trim().min(3).max(20),
  password: z.string().min(6).max(128),
});

const loginSchema = z
  .object({
    email: z.string().email().max(120).optional(),
    matric: z.string().trim().min(3).max(20).optional(),
    password: z.string().min(1).max(128),
  })
  .refine((v) => Boolean(v.email || v.matric), { message: "Email or matric required" });

const selectionSchema = z.object({
  positionId: z.string().min(1).max(60),
  candidateId: z.string().min(1).max(60),
});

const voteSchema = z.object({
  selections: z.array(selectionSchema).min(1).max(100),
});

const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional().default(""),
  issue: z.string().max(1000).optional().default(""),
});

function issueAuthCookies(res, token) {
  const csrfToken = crypto.randomBytes(24).toString("hex");
  res.cookie("auth_token", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
  res.cookie("csrf_token", csrfToken, {
    httpOnly: false,
    secure: isProd,
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
  return csrfToken;
}
/* ---------------- DB ---------------- */
mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log("✅ MongoDB connected");

    const exists = await Election.findOne({ key: "current" });
    if (!exists) {
      await Election.create(currentElectionSeed);
      console.log("✅ Seeded current election");
    }
  })
  .catch((err) => {
    console.error("❌ Mongo error:", err.message);
    process.exit(1);
  });

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "server", time: new Date().toISOString() });
});

/* ---------------- AUTH ---------------- */
app.post("/api/auth/register", async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid registration payload" });
    const { email, matric, password } = parsed.data;

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedMatric = String(matric).trim().toUpperCase();

    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(409).json({ ok: false, message: "Email already registered" });
    }
    if (await User.findOne({ matric: normalizedMatric })) {
      return res.status(409).json({ ok: false, message: "Matric already registered" });
    }

    const passwordHash = await bcrypt.hash(String(password), 12);

    const user = await User.create({
      email: normalizedEmail,
      matric: normalizedMatric,
      passwordHash,
      role: "voter",
    });

    return res.json({
      ok: true,
      user: { id: user._id, email: user.email, matric: user.matric, role: user.role },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid login payload" });
    const { email, matric, password } = parsed.data;

    const normalizedEmail = email ? String(email).trim().toLowerCase() : "";
    const normalizedMatric = matric ? String(matric).trim().toUpperCase() : "";

    const user = await User.findOne(email ? { email: normalizedEmail } : { matric: normalizedMatric });
    if (!user) return res.status(401).json({ ok: false, message: "Invalid login" });

    const valid = await bcrypt.compare(String(password), user.passwordHash);
    if (!valid) return res.status(401).json({ ok: false, message: "Invalid credentials" });

    const token = jwt.sign(
      { sub: String(user._id), email: user.email, matric: user.matric, role: user.role || "voter" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    const csrfToken = issueAuthCookies(res, token);

    return res.json({
      ok: true,
      csrfToken,
      user: { id: user._id, email: user.email, matric: user.matric, role: user.role || "voter" },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("auth_token", { path: "/" });
  res.clearCookie("csrf_token", { path: "/" });
  return res.json({ ok: true });
});

/* ---------------- VOTER ROUTES ---------------- */
app.get("/api/election/current", auth, async (req, res) => {
  try {
    const election = await Election.findOne({ key: "current" }).lean();
    if (!election) return res.status(404).json({ ok: false, message: "No election found" });

    const alreadyVoted = await Vote.findOne({ electionKey: "current", voterId: req.user.sub }).lean();
    return res.json({ ok: true, election, alreadyVoted: !!alreadyVoted });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

app.post("/api/votes/submit", auth, async (req, res) => {
  try {
    const parsed = voteSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid vote payload" });
    const { selections } = parsed.data;

    const election = await Election.findOne({ key: "current" }).lean();
    if (!election) return res.status(404).json({ ok: false, message: "No election found" });

    const requiredPositions = (election.positions || []).map((p) => p.id);

    const chosen = new Map();
    for (const s of selections) {
      const pid = s.positionId;
      const cid = s.candidateId;

      if (!pid || !cid) return res.status(400).json({ ok: false, message: "Invalid selection" });
      if (chosen.has(pid)) return res.status(400).json({ ok: false, message: "Duplicate position selection" });

      const pos = (election.positions || []).find((p) => p.id === pid);
      if (!pos) return res.status(400).json({ ok: false, message: "Unknown position" });

      const candidateOk = (pos.candidates || []).some((c) => c.id === cid);
      if (!candidateOk) return res.status(400).json({ ok: false, message: "Candidate not in position" });

      chosen.set(pid, cid);
    }

    for (const pid of requiredPositions) {
      if (!chosen.has(pid)) return res.status(400).json({ ok: false, message: "Ballot incomplete" });
    }

    const existing = await Vote.findOne({ electionKey: "current", voterId: req.user.sub }).lean();
    if (existing) return res.status(409).json({ ok: false, message: "You have already voted." });

    const receiptId = nanoid(12);
    const receiptHash = makeHash(receiptId, req.user.matric, "current");

    const vote = await Vote.create({
      electionKey: "current",
      voterId: req.user.sub,
      voterMatric: req.user.matric,
      selections,
      receiptId,
      receiptHash,
    });

    let chainRecorded = false;
    let txHash = "";
    try {
      const r = await storeReceiptOnChain(receiptId, req.user.matric, "current");
      chainRecorded = true;
      txHash = r?.txHash || "";
    } catch {}

    return res.json({
      ok: true,
      receiptId: vote.receiptId,
      receiptHash: vote.receiptHash,
      chainRecorded,
      txHash,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: "Vote submission failed" });
  }
});

/* ✅ LOAD MY RECEIPT (THIS MUST EXIST OR YOU GET /mine 404) */
app.get("/api/votes/mine", auth, async (req, res) => {
  try {
    const vote = await Vote.findOne({ electionKey: "current", voterId: req.user.sub }).lean();
    if (!vote) return res.json({ ok: true, receiptId: null, receiptHash: null });

    return res.json({ ok: true, receiptId: vote.receiptId, receiptHash: vote.receiptHash });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: "Failed to load receipt" });
  }
});

/* ✅ VERIFY RECEIPT (THIS MUST EXIST OR YOU GET /verify/:id 404) */
app.get("/api/verify/:id", async (req, res) => {
  try {
    const receiptId = String(req.params.id || "").trim();
    if (!receiptId) return res.status(400).json({ found: false, message: "Receipt ID required" });

    const vote = await Vote.findOne({ receiptId }).lean();
    if (!vote) return res.json({ found: false });

    const expectedHash = makeHash(vote.receiptId, vote.voterMatric, vote.electionKey);
    const legacyHash = makeLegacyHash(vote.receiptId, vote.voterMatric, vote.electionKey);

    return res.json({
      found: true,
      match: expectedHash === vote.receiptHash || legacyHash === vote.receiptHash,
      receiptHash: vote.receiptHash,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ found: false });
  }
});
 /* ---------------- FEEDBACK ---------------- */

app.post("/api/feedback", auth, async (req, res) => {
  try {
    const parsed = feedbackSchema.safeParse({
      rating: Number(req.body?.rating),
      comment: String(req.body?.comment || ""),
      issue: String(req.body?.issue || ""),
    });
    if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid feedback payload" });
    const { rating, comment, issue } = parsed.data;

    await Feedback.create({
      voterId: req.user.sub,
      voterMatric: req.user.matric,
      rating,
      comment,
      issue,
      electionKey: "current",
    });

    return res.json({ ok: true, message: "Feedback saved" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Feedback failed" });
  }
});
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  if (!fs.existsSync(clientDistPath)) return next();
  return res.sendFile(path.join(clientDistPath, "index.html"), (err) => {
    if (err) return next(err);
  });
});

app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));





