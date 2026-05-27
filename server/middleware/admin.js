const express = require("express");
const bcrypt = require("bcryptjs");
const { nanoid } = require("nanoid");

const auth = require("./auth");
const requireAdmin = require("./requireAdmin");

const Vote = require("../models/Vote");
const Election = require("../models/Election");
const Feedback = require("../models/Feedback");
const User = require("../models/User");
const AdminAudit = require("../models/AdminAudit");

const router = express.Router();

function parseDateOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function getCurrentElectionDoc() {
  let election = await Election.findOne({ isCurrent: true }).sort({ updatedAt: -1 });
  if (election) return election;

  election = await Election.findOne({ key: "current" });
  if (election) {
    election.isCurrent = true;
    if (election.archivedAt) election.archivedAt = null;
    await election.save();
  }
  return election;
}

function normalizePositions(positions) {
  if (!Array.isArray(positions)) return [];
  return positions.map((p, idx) => ({
    id: String(p.id || `pos-${idx + 1}`).trim(),
    name: String(p.name || p.title || "").trim(),
    candidates: Array.isArray(p.candidates)
      ? p.candidates.map((c, cidx) => ({
          id: String(c.id || `c-${idx + 1}-${cidx + 1}`).trim(),
          name: String(c.name || "").trim(),
          dept: String(c.dept || c.department || "").trim(),
        }))
      : [],
  }));
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function rowsToCsv(rows) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

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

router.get("/results", auth, requireAdmin, async (req, res) => {
  try {
    const election = await getCurrentElectionDoc();
    if (!election) return res.status(404).json({ ok: false, message: "Election not found" });

    const [votes, feedback] = await Promise.all([
      Vote.find({ electionKey: election.key }).sort({ createdAt: -1 }).lean(),
      Feedback.find({ electionKey: election.key }).sort({ createdAt: -1 }).lean(),
    ]);

    return res.json({
      ok: true,
      election,
      electionKey: election.key,
      votes: Array.isArray(votes) ? votes : [],
      feedback: Array.isArray(feedback) ? feedback : [],
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: "Failed to load results" });
  }
});

router.get("/feedback", auth, requireAdmin, async (req, res) => {
  try {
    const election = await getCurrentElectionDoc();
    const query = election ? { electionKey: election.key } : {};
    const feedback = await Feedback.find(query).sort({ createdAt: -1 }).lean();

    return res.json({
      ok: true,
      feedback: Array.isArray(feedback) ? feedback : [],
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: "Failed to load feedback" });
  }
});

router.get("/admins", auth, requireAdmin, async (req, res) => {
  try {
    const admins = await User.find({ role: "admin" })
      .sort({ createdAt: -1 })
      .select("_id email matric role createdAt updatedAt")
      .lean();

    return res.json({
      ok: true,
      admins: Array.isArray(admins) ? admins : [],
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: "Failed to load admins" });
  }
});

router.post("/admins", auth, requireAdmin, requireAdminReauth, async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const matric = String(req.body?.matric || "").trim().toUpperCase();
    const password = String(req.body?.password || "");

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, message: "Valid email is required" });
    }
    if (!matric || matric.length < 3 || matric.length > 20) {
      return res.status(400).json({ ok: false, message: "Matric must be 3 to 20 characters" });
    }
    if (password.length < 6 || password.length > 128) {
      return res.status(400).json({ ok: false, message: "Password must be 6 to 128 characters" });
    }

    if (await User.findOne({ email })) {
      return res.status(409).json({ ok: false, message: "Email already registered" });
    }
    if (await User.findOne({ matric })) {
      return res.status(409).json({ ok: false, message: "Matric already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const adminUser = await User.create({
      email,
      matric,
      passwordHash,
      role: "admin",
    });

    await AdminAudit.create({
      adminId: req.user.sub,
      adminMatric: req.user.matric,
      action: "admin.create",
      details: {
        createdAdminId: String(adminUser._id),
        createdAdminEmail: adminUser.email,
        createdAdminMatric: adminUser.matric,
      },
    });

    return res.status(201).json({
      ok: true,
      message: "Admin created",
      admin: {
        id: adminUser._id,
        email: adminUser.email,
        matric: adminUser.matric,
        role: adminUser.role,
        createdAt: adminUser.createdAt,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: "Failed to create admin" });
  }
});

router.delete("/admins/:id", auth, requireAdmin, requireAdminReauth, async (req, res) => {
  try {
    const adminId = String(req.params.id || "").trim();
    if (!adminId) return res.status(400).json({ ok: false, message: "Admin id is required" });
    if (adminId === String(req.user.sub)) {
      return res.status(400).json({ ok: false, message: "You cannot remove your own admin account" });
    }

    const totalAdmins = await User.countDocuments({ role: "admin" });
    if (totalAdmins <= 1) {
      return res.status(400).json({ ok: false, message: "At least one admin account must remain" });
    }

    const target = await User.findOneAndDelete({ _id: adminId, role: "admin" }).lean();
    if (!target) return res.status(404).json({ ok: false, message: "Admin not found" });

    await AdminAudit.create({
      adminId: req.user.sub,
      adminMatric: req.user.matric,
      action: "admin.remove",
      details: {
        removedAdminId: adminId,
        removedAdminEmail: target.email,
        removedAdminMatric: target.matric,
      },
    });

    return res.json({ ok: true, message: "Admin removed" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: "Failed to remove admin" });
  }
});

router.get("/elections", auth, requireAdmin, async (req, res) => {
  try {
    const [currentElection, elections, audits] = await Promise.all([
      getCurrentElectionDoc(),
      Election.find({}).sort({ createdAt: -1 }).lean(),
      AdminAudit.find({}).sort({ createdAt: -1 }).limit(100).lean(),
    ]);

    return res.json({
      ok: true,
      currentElection,
      elections: Array.isArray(elections) ? elections : [],
      audits: Array.isArray(audits) ? audits : [],
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: "Failed to load elections" });
  }
});

router.post("/elections", auth, requireAdmin, requireAdminReauth, async (req, res) => {
  try {
    const title = String(req.body?.title || "").trim();
    const startsAt = parseDateOrNull(req.body?.startsAt);
    const endsAt = parseDateOrNull(req.body?.endsAt);
    const positions = normalizePositions(req.body?.positions);

    if (!title) return res.status(400).json({ ok: false, message: "Election title is required" });
    if (startsAt && endsAt && startsAt > endsAt) {
      return res.status(400).json({ ok: false, message: "Start time must be before end time" });
    }
    if (!positions.length) {
      return res.status(400).json({ ok: false, message: "At least one position is required" });
    }

    const existingCurrent = await getCurrentElectionDoc();
    if (existingCurrent) {
      existingCurrent.isCurrent = false;
      existingCurrent.isActive = false;
      existingCurrent.archivedAt = new Date();
      await existingCurrent.save();
    }

    const election = await Election.create({
      key: `election-${Date.now()}-${nanoid(6)}`,
      title,
      isCurrent: true,
      isActive: req.body?.isActive === false ? false : true,
      startsAt,
      endsAt,
      archivedAt: null,
      positions,
    });

    await AdminAudit.create({
      adminId: req.user.sub,
      adminMatric: req.user.matric,
      action: "election.create",
      details: {
        electionKey: election.key,
        title: election.title,
        startsAt: election.startsAt,
        endsAt: election.endsAt,
      },
    });

    return res.status(201).json({ ok: true, election });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: "Failed to create election" });
  }
});

router.put("/election/current", auth, requireAdmin, requireAdminReauth, async (req, res) => {
  try {
    const election = await getCurrentElectionDoc();
    if (!election) return res.status(404).json({ ok: false, message: "Election not found" });

    if (req.body?.title !== undefined) election.title = String(req.body?.title || "").trim() || election.title;
    if (req.body?.positions !== undefined) {
      if (!Array.isArray(req.body.positions)) {
        return res.status(400).json({ ok: false, message: "positions must be an array" });
      }
      election.positions = normalizePositions(req.body.positions);
    }

    if (req.body?.startsAt !== undefined) {
      const startsAt = parseDateOrNull(req.body.startsAt);
      if (req.body.startsAt && !startsAt) return res.status(400).json({ ok: false, message: "Invalid start time" });
      election.startsAt = startsAt;
    }

    if (req.body?.endsAt !== undefined) {
      const endsAt = parseDateOrNull(req.body.endsAt);
      if (req.body.endsAt && !endsAt) return res.status(400).json({ ok: false, message: "Invalid end time" });
      election.endsAt = endsAt;
    }

    if (election.startsAt && election.endsAt && election.startsAt > election.endsAt) {
      return res.status(400).json({ ok: false, message: "Start time must be before end time" });
    }

    if (typeof req.body?.isActive === "boolean") {
      election.isActive = req.body.isActive;
    }

    await election.save();

    await AdminAudit.create({
      adminId: req.user.sub,
      adminMatric: req.user.matric,
      action: "election.update_current",
      details: {
        electionKey: election.key,
        title: election.title,
        positionsCount: election.positions.length,
        startsAt: election.startsAt,
        endsAt: election.endsAt,
        isActive: election.isActive,
      },
    });

    return res.json({ ok: true, election });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: "Failed to save election" });
  }
});

router.patch("/election/current/status", auth, requireAdmin, requireAdminReauth, async (req, res) => {
  try {
    const election = await getCurrentElectionDoc();
    if (!election) return res.status(404).json({ ok: false, message: "Election not found" });

    if (typeof req.body?.isActive !== "boolean") {
      return res.status(400).json({ ok: false, message: "isActive must be boolean" });
    }

    election.isActive = req.body.isActive;
    await election.save();

    await AdminAudit.create({
      adminId: req.user.sub,
      adminMatric: req.user.matric,
      action: req.body.isActive ? "election.enable" : "election.disable",
      details: {
        electionKey: election.key,
        title: election.title,
      },
    });

    return res.json({ ok: true, election });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: "Failed to update election status" });
  }
});

router.post("/election/current/archive", auth, requireAdmin, requireAdminReauth, async (req, res) => {
  try {
    const election = await getCurrentElectionDoc();
    if (!election) return res.status(404).json({ ok: false, message: "Election not found" });

    election.isCurrent = false;
    election.isActive = false;
    election.archivedAt = new Date();
    await election.save();

    await AdminAudit.create({
      adminId: req.user.sub,
      adminMatric: req.user.matric,
      action: "election.archive",
      details: {
        electionKey: election.key,
        title: election.title,
      },
    });

    return res.json({ ok: true, election });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: "Failed to archive election" });
  }
});

router.get("/audit/export", auth, requireAdmin, async (req, res) => {
  try {
    const audits = await AdminAudit.find({}).sort({ createdAt: -1 }).lean();
    const rows = [
      ["createdAt", "adminMatric", "action", "details"],
      ...audits.map((audit) => [
        audit.createdAt ? new Date(audit.createdAt).toISOString() : "",
        audit.adminMatric || "",
        audit.action || "",
        JSON.stringify(audit.details || {}),
      ]),
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="admin-audit-${Date.now()}.csv"`);
    return res.send(rowsToCsv(rows));
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: "Failed to export audit log" });
  }
});

router.get("/report/export", auth, requireAdmin, async (req, res) => {
  try {
    const election = await getCurrentElectionDoc();
    if (!election) return res.status(404).json({ ok: false, message: "Election not found" });

    const votes = await Vote.find({ electionKey: election.key }).lean();
    const tally = new Map();
    for (const vote of votes) {
      for (const selection of vote.selections || []) {
        const key = `${selection.positionId}:${selection.candidateId}`;
        tally.set(key, (tally.get(key) || 0) + 1);
      }
    }

    const rows = [["electionKey", "title", "positionId", "positionName", "candidateId", "candidateName", "department", "votes"]];
    for (const position of election.positions || []) {
      for (const candidate of position.candidates || []) {
        rows.push([
          election.key,
          election.title,
          position.id,
          position.name,
          candidate.id,
          candidate.name,
          candidate.dept || "",
          tally.get(`${position.id}:${candidate.id}`) || 0,
        ]);
      }
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="election-report-${election.key}.csv"`);
    return res.send(rowsToCsv(rows));
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: "Failed to export report" });
  }
});

router.get("/backup/export", auth, requireAdmin, async (req, res) => {
  try {
    const [users, elections, votes, feedback, audits] = await Promise.all([
      User.find({}).lean(),
      Election.find({}).lean(),
      Vote.find({}).lean(),
      Feedback.find({}).lean(),
      AdminAudit.find({}).lean(),
    ]);

    const backup = {
      exportedAt: new Date().toISOString(),
      exportedBy: {
        id: req.user.sub,
        matric: req.user.matric,
      },
      users,
      elections,
      votes,
      feedback,
      audits,
    };

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="blockchain-voting-backup-${Date.now()}.json"`);
    return res.send(JSON.stringify(backup, null, 2));
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: "Failed to export backup" });
  }
});

router.post("/backup/restore", auth, requireAdmin, requireAdminReauth, async (req, res) => {
  try {
    const snapshot = req.body?.snapshot;
    if (!snapshot || typeof snapshot !== "object") {
      return res.status(400).json({ ok: false, message: "snapshot object is required" });
    }

    let restored = {
      users: 0,
      elections: 0,
      votes: 0,
      feedback: 0,
      audits: 0,
    };

    for (const user of Array.isArray(snapshot.users) ? snapshot.users : []) {
      if (!user?.email || !user?.matric || !user?.passwordHash) continue;
      const existing = await User.findOne({ email: String(user.email).trim().toLowerCase() });
      if (existing) continue;
      await User.create({
        email: String(user.email).trim().toLowerCase(),
        matric: String(user.matric).trim().toUpperCase(),
        passwordHash: String(user.passwordHash),
        role: user.role === "admin" ? "admin" : "voter",
      });
      restored.users += 1;
    }

    for (const election of Array.isArray(snapshot.elections) ? snapshot.elections : []) {
      if (!election?.key || !election?.title) continue;
      const existing = await Election.findOne({ key: String(election.key) });
      if (existing) continue;
      await Election.create({
        key: String(election.key),
        title: String(election.title),
        isCurrent: !!election.isCurrent,
        isActive: election.isActive !== false,
        startsAt: parseDateOrNull(election.startsAt),
        endsAt: parseDateOrNull(election.endsAt),
        archivedAt: parseDateOrNull(election.archivedAt),
        positions: normalizePositions(election.positions),
      });
      restored.elections += 1;
    }

    for (const vote of Array.isArray(snapshot.votes) ? snapshot.votes : []) {
      if (!vote?.receiptId || !vote?.receiptHash || !vote?.voterId || !vote?.electionKey) continue;
      const existing = await Vote.findOne({ receiptId: String(vote.receiptId) });
      if (existing) continue;
      await Vote.create({
        electionKey: String(vote.electionKey),
        voterId: vote.voterId,
        voterMatric: String(vote.voterMatric || "").trim().toUpperCase(),
        selections: Array.isArray(vote.selections) ? vote.selections : [],
        receiptId: String(vote.receiptId),
        receiptHash: String(vote.receiptHash),
      });
      restored.votes += 1;
    }

    for (const item of Array.isArray(snapshot.feedback) ? snapshot.feedback : []) {
      const signature = {
        electionKey: String(item?.electionKey || ""),
        voterMatric: String(item?.voterMatric || "").trim().toUpperCase(),
        createdAt: item?.createdAt ? new Date(item.createdAt) : null,
      };
      if (!signature.electionKey || !signature.voterMatric || !signature.createdAt) continue;
      const existing = await Feedback.findOne(signature);
      if (existing) continue;
      await Feedback.create({
        electionKey: signature.electionKey,
        voterId: item?.voterId || null,
        voterMatric: signature.voterMatric,
        rating: Number(item?.rating) || 0,
        comment: String(item?.comment || ""),
        issue: String(item?.issue || ""),
        createdAt: signature.createdAt,
      });
      restored.feedback += 1;
    }

    for (const audit of Array.isArray(snapshot.audits) ? snapshot.audits : []) {
      const createdAt = audit?.createdAt ? new Date(audit.createdAt) : null;
      if (!audit?.adminId || !audit?.action || !createdAt) continue;
      const existing = await AdminAudit.findOne({
        adminId: audit.adminId,
        action: String(audit.action),
        createdAt,
      });
      if (existing) continue;
      await AdminAudit.create({
        adminId: audit.adminId,
        adminMatric: String(audit.adminMatric || "").trim().toUpperCase(),
        action: String(audit.action),
        details: audit.details || {},
        createdAt,
      });
      restored.audits += 1;
    }

    await AdminAudit.create({
      adminId: req.user.sub,
      adminMatric: req.user.matric,
      action: "backup.restore",
      details: restored,
    });

    return res.json({ ok: true, message: "Backup restored in merge mode", restored });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: "Failed to restore backup" });
  }
});

module.exports = router;
