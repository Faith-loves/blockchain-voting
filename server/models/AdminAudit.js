const mongoose = require("mongoose");

const adminAuditSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    adminMatric: { type: String, trim: true, uppercase: true, default: "" },
    action: { type: String, required: true, trim: true },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

adminAuditSchema.index({ adminId: 1, createdAt: -1 });
adminAuditSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model("AdminAudit", adminAuditSchema);
