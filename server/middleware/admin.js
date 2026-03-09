// server/middleware/admin.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");

const auth = require("./auth");
const requireAdmin = require("./requireAdmin");

const Vote = require("../models/Vote");
const Election = require("../models/Election");
const Feedback = require("../models/Feedback");
const User = require("../models/User");
const AdminAudit = require("../models/AdminAudit");

async function requireAdminReauth(req, res, next) {
  if (process.env.ADMIN_REAUTH_REQUIRED !== "true") return next();
  try {
    const adminPassword = String(req.body?.adminPassword || req.headers["x-admin-password"] || "");
    if (!adminPassword) return res.status(401).json({ ok: false, message: "Admin password confirmation required" });

    const admin = await User.findById(req.user.sub).select("passwordHash").lean();
    if (!admin?.passwordHash) return res.status(401).json({ ok: false, message: "Admin account not found" });

    const ok = await bcrypt.compare(adminPassword, admin.passwordHash);
    if (!ok) return res.status(401).json({ ok: false, message: "Admin password confirmation failed" });
    return next();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: "Admin confirmation failed" });
  }
}

// GET /api/admin/results
router.get("/results", auth, requireAdmin, async (req, res) => {
  try {
    const election = await Election.findOne({ key: "current" }).lean();
    if (!election) return res.status(404).json({ ok: false, message: "Election not found" });

    const [votes, feedback] = await Promise.all([
      Vote.find({ electionKey: election.key }).sort({ createdAt: -1 }).lean(),
      Feedback.find({}).sort({ createdAt: -1 }).lean(),
    ]);

    return res.json({
      ok: true,
      electionKey: election.key,
      votes: Array.isArray(votes) ? votes : [],
      feedback: Array.isArray(feedback) ? feedback : [],
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: "Failed to load results" });
  }
});

// GET /api/admin/feedback
router.get("/feedback", auth, requireAdmin, async (req, res) => {
  try {
    const feedback = await Feedback.find({}).sort({ createdAt: -1 }).lean();

    return res.json({
      ok: true,
      feedback: Array.isArray(feedback) ? feedback : [],
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: "Failed to load feedback" });
  }
});

// PUT /api/admin/election/current
router.put("/election/current", auth, requireAdmin, requireAdminReauth, async (req, res) => {
  try {
    const { positions } = req.body || {};
    if (!Array.isArray(positions)) {
      return res.status(400).json({ ok: false, message: "positions must be an array" });
    }

    const election = await Election.findOne({ key: "current" });
    if (!election) return res.status(404).json({ ok: false, message: "Election not found" });

    // Normalize to YOUR schema: position.name + candidate.dept
    election.positions = positions.map((p) => ({
      id: String(p.id || "").trim(),
      name: String(p.name || p.title || "").trim(),
      candidates: (p.candidates || []).map((c) => ({
        id: String(c.id || "").trim(),
        name: String(c.name || "").trim(),
        dept: String(c.dept || c.department || "").trim(),
      })),
    }));

    await election.save();
    await AdminAudit.create({
      adminId: req.user.sub,
      adminMatric: req.user.matric,
      action: "election.update_current",
      details: {
        positionsCount: election.positions.length,
      },
    });

    return res.json({ ok: true, election });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: "Failed to save election" });
  }
});

module.exports = router;

