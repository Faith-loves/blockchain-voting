// server/middleware/auth.js
const jwt = require("jsonwebtoken");

module.exports = function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
    const cookieToken = req.cookies?.auth_token || "";
    const token = cookieToken || bearerToken;
    if (!token || token.length < 10) return res.status(401).json({ ok: false, message: "Unauthorized" });

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET missing in env");
      return res.status(500).json({ ok: false, message: "Server misconfiguration" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded?.sub || !decoded?.matric) {
      return res.status(401).json({ ok: false, message: "Invalid token payload" });
    }

    // ✅ include role
    req.user = {
      sub: decoded.sub,
      email: decoded.email,
      matric: decoded.matric,
      role: decoded.role || "voter",
    };

    return next();
  } catch (err) {
    return res.status(401).json({ ok: false, message: "Invalid or expired token" });
  }
};
