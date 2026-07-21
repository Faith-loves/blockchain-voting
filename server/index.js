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
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGINS || CLIENT_ORIGIN)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const VERCEL_PREVIEW_ORIGIN = /^https:\/\/blockchain-voting-[a-z0-9-]+\.vercel\.app$/i;

function isAllowedOrigin(origin) {
  return CLIENT_ORIGINS.includes(origin) || VERCEL_PREVIEW_ORIGIN.test(origin);
}
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};
const csrfCookieOptions = {
  ...cookieOptions,
  httpOnly: false,
};

if (!MONGO_URI) {
  console.error("Missing MONGO_URI");
  process.exit(1);
}
if (!JWT_SECRET) {
  console.error("Missing JWT_SECRET");
  process.exit(1);
}
if (!process.env.RECEIPT_SECRET) {
  console.error("Missing RECEIPT_SECRET");
  process.exit(1);
}

function parseDateOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isElectionOpen(election) {
  if (!election) return false;
  if (!election.isActive) return false;
  if (election.archivedAt) return false;

  const now = Date.now();
  const startsAt = parseDateOrNull(election.startsAt);
  const endsAt = parseDateOrNull(election.endsAt);

  if (startsAt && startsAt.getTime() > now) return false;
  if (endsAt && endsAt.getTime() < now) return false;

  return true;
}

async function getCurrentElection() {
  let election = await Election.findOne({ isCurrent: true }).sort({ updatedAt: -1 });
  if (election) return election;

  election = await Election.findOne({ key: "current" });
  if (election) {
    election.isCurrent = true;
    if (election.archivedAt) election.archivedAt = null;
    await election.save();
    return election;
  }

  return null;
}

function issueAuthCookies(res, token) {
  const csrfToken = crypto.randomBytes(24).toString("hex");
  res.cookie("auth_token", token, cookieOptions);
  res.cookie("csrf_token", csrfToken, csrfCookieOptions);
  return csrfToken;
}

app.set("trust proxy", 1);

// FIX 1: Disable Helmet's CSP — it intercepts Vite's hashed assets
// and returns an HTML error page instead of the actual CSS/JS files,
// causing the "MIME type text/html" white screen error.
app.use(helmet({ contentSecurityPolicy: false }));

// FIX 2: Allow both CLIENT_ORIGIN env var and the hardcoded Render URL
// so assets are never CORS-blocked when CLIENT_ORIGIN isn't set on Render.
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (isAllowedOrigin(origin)) return cb(null, true);
      return cb(new Error("CORS blocked"));
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));

const clientDistPath = path.resolve(__dirname, "../client/dist");
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
}

app.use((req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  const openPaths = new Set([
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/logout",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
  ]);
  if (openPaths.has(req.path)) return next();

  const requestOrigin = req.headers.origin || "";
  const csrfCookie = req.cookies?.csrf_token || "";
  const csrfHeader = req.headers["x-csrf-token"] || "";
  const trustedSplitFrontend = isProd && requestOrigin && isAllowedOrigin(requestOrigin);

  if (trustedSplitFrontend && csrfHeader) {
    return next();
  }

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
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
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/reset-password", authLimiter);
app.use("/api/votes/submit", submitLimiter);
app.use("/api/feedback", submitLimiter);

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

const forgotPasswordSchema = z.object({
  email: z.string().email().max(120),
  matric: z.string().trim().min(3).max(20),
});

const resetPasswordSchema = z.object({
  token: z.string().min(12).max(256),
  password: z.string().min(6).max(128),
});

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

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log("MongoDB connected");

    const currentElection = await getCurrentElection();
    if (!currentElection) {
      await Election.create(currentElectionSeed);
      console.log("Seeded current election");
    } else if (
      currentElection.key === currentElectionSeed.key &&
      currentElection.title === currentElectionSeed.title &&
      currentElection.endsAt &&
      currentElection.endsAt.getTime() < Date.now()
    ) {
      currentElection.isActive = true;
      currentElection.startsAt = null;
      currentElection.endsAt = null;
      currentElection.archivedAt = null;
      await currentElection.save();
      console.log("Reopened seeded prototype election");
    }
  })
  .catch((err) => {
    console.error("Mongo error:", err.message);
    process.exit(1);
  });

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "server", time: new Date().toISOString() });
});

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

    let user = null;
    if (normalizedEmail && normalizedMatric) {
      user = await User.findOne({ email: normalizedEmail, matric: normalizedMatric });
    }
    if (!user && normalizedEmail) {
      user = await User.findOne({ email: normalizedEmail });
    }
    if (!user && normalizedMatric) {
      user = await User.findOne({ matric: normalizedMatric });
    }
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
  res.clearCookie("auth_token", cookieOptions);
  res.clearCookie("csrf_token", csrfCookieOptions);
  return res.json({ ok: true });
});

app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid recovery payload" });

    const email = String(parsed.data.email).trim().toLowerCase();
    const matric = String(parsed.data.matric).trim().toUpperCase();
    const user = await User.findOne({ email, matric });

    if (!user) {
      return res.json({
        ok: true,
        message: "If the account exists, a reset token will be generated.",
      });
    }

    const resetToken = crypto.randomBytes(24).toString("hex");
    user.resetPasswordTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.resetPasswordExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    return res.json({
      ok: true,
      message: "Reset token generated. Copy it now because email delivery is not configured yet.",
      resetToken,
      resetUrl: `/reset-password?token=${encodeURIComponent(resetToken)}`,
      expiresAt: user.resetPasswordExpiresAt,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: "Failed to start password reset" });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid reset payload" });

    const tokenHash = crypto.createHash("sha256").update(String(parsed.data.token)).digest("hex");
    const user = await User.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpiresAt: { $gt: new Date() },
    });

    if (!user) return res.status(400).json({ ok: false, message: "Reset token is invalid or expired" });

    user.passwordHash = await bcrypt.hash(String(parsed.data.password), 12);
    user.resetPasswordTokenHash = "";
    user.resetPasswordExpiresAt = null;
    await user.save();

    return res.json({ ok: true, message: "Password reset successful" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: "Failed to reset password" });
  }
});

app.use("/api/admin", adminRouter);

app.get("/api/election/current", auth, async (req, res) => {
  try {
    const election = await getCurrentElection();
    if (!election) return res.status(404).json({ ok: false, message: "No election found" });

    const alreadyVoted = await Vote.findOne({ electionKey: election.key, voterId: req.user.sub }).lean();
    return res.json({
      ok: true,
      election,
      alreadyVoted: !!alreadyVoted,
      electionOpen: isElectionOpen(election),
    });
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
    const election = await getCurrentElection();
    if (!election) return res.status(404).json({ ok: false, message: "No election found" });
    if (!isElectionOpen(election)) {
      return res.status(403).json({ ok: false, message: "Election is not active right now" });
    }

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

    const existing = await Vote.findOne({ electionKey: election.key, voterId: req.user.sub }).lean();
    if (existing) return res.status(409).json({ ok: false, message: "You have already voted." });

    const receiptId = nanoid(12);
    const receiptHash = makeHash(receiptId, req.user.matric, election.key);

    const vote = await Vote.create({
      electionKey: election.key,
      voterId: req.user.sub,
      voterMatric: req.user.matric,
      selections,
      receiptId,
      receiptHash,
    });

    let chainRecorded = false;
    let txHash = "";
    try {
      const result = await Promise.race([
        storeReceiptOnChain(receiptId, req.user.matric, election.key),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Blockchain write timed out")), 5000);
        }),
      ]);
      chainRecorded = true;
      txHash = result?.txHash || "";
    } catch (err) {
      console.warn("Receipt saved in database, but blockchain recording failed:", err.message);
    }

    return res.json({
      ok: true,
      electionKey: election.key,
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

app.get("/api/votes/mine", auth, async (req, res) => {
  try {
    const vote = await Vote.findOne({ voterId: req.user.sub }).sort({ createdAt: -1 }).lean();
    if (!vote) return res.json({ ok: true, receiptId: null, receiptHash: null });

    return res.json({
      ok: true,
      receiptId: vote.receiptId,
      receiptHash: vote.receiptHash,
      electionKey: vote.electionKey,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: "Failed to load receipt" });
  }
});

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
      electionKey: vote.electionKey,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ found: false });
  }
});

app.post("/api/feedback", auth, async (req, res) => {
  try {
    const parsed = feedbackSchema.safeParse({
      rating: Number(req.body?.rating),
      comment: String(req.body?.comment || ""),
      issue: String(req.body?.issue || ""),
    });
    if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid feedback payload" });

    const election = await getCurrentElection();
    const electionKey = election?.key || "current";

    await Feedback.create({
      voterId: req.user.sub,
      voterMatric: req.user.matric,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      issue: parsed.data.issue,
      electionKey,
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

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));


