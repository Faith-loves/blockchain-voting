// server/middleware/requireAdmin.js
module.exports = function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ ok: false, message: "Unauthorized" });
  if (req.user.role !== "admin") {
    return res.status(403).json({ ok: false, message: "Admin access required" });
  }
  return next();
};