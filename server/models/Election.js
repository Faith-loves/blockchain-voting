const mongoose = require("mongoose");

const candidateSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    dept: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false }
);

const positionSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    candidates: {
      type: [candidateSchema],
      validate: {
        validator(arr) {
          const ids = arr.map((c) => c.id);
          return new Set(ids).size === ids.length;
        },
        message: "Duplicate candidate IDs detected",
      },
    },
  },
  { _id: false }
);

const electionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    isCurrent: {
      type: Boolean,
      default: false,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    startsAt: {
      type: Date,
      default: null,
    },

    endsAt: {
      type: Date,
      default: null,
    },

    archivedAt: {
      type: Date,
      default: null,
      index: true,
    },

    positions: {
      type: [positionSchema],
      validate: {
        validator(arr) {
          const ids = arr.map((p) => p.id);
          return new Set(ids).size === ids.length;
        },
        message: "Duplicate position IDs detected",
      },
    },
  },
  { timestamps: true }
);

electionSchema.index({ key: 1, isActive: 1 });
electionSchema.index({ isCurrent: 1, archivedAt: 1 });
electionSchema.index({ startsAt: 1, endsAt: 1 });

module.exports = mongoose.model("Election", electionSchema);
