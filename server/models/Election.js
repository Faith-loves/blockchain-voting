const mongoose = require("mongoose");

/* Candidate */
const candidateSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    dept: {
      type: String,
      default: "",
      trim: true
    }
  },
  { _id: false }
);

/* Position */
const positionSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    candidates: {
      type: [candidateSchema],
      validate: {
        validator(arr) {
          const ids = arr.map(c => c.id);
          return new Set(ids).size === ids.length;
        },
        message: "Duplicate candidate IDs detected"
      }
    }
  },
  { _id: false }
);

/* Election */
const electionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    title: {
      type: String,
      required: true,
      trim: true
    },

    isActive: {
      type: Boolean,
      default: true
    },

    positions: {
      type: [positionSchema],
      validate: {
        validator(arr) {
          const ids = arr.map(p => p.id);
          return new Set(ids).size === ids.length;
        },
        message: "Duplicate position IDs detected"
      }
    }
  },
  { timestamps: true }
);

/* Indexes for fast verification */
electionSchema.index({ key: 1, isActive: 1 });

module.exports = mongoose.model("Election", electionSchema);