const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
  {
    electionKey: {
      type: String,
      required: true,
      trim: true,
      index: true
    },

    voterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    voterMatric: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },

    comment: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ""
    },

    issue: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ""
    }
  },
  { timestamps: true }
);


/* Prevent spam submissions */
feedbackSchema.index(
  { electionKey: 1, voterMatric: 1 },
  { unique: false }
);


/* Fast admin analytics queries */
feedbackSchema.index({ rating: 1 });


module.exports = mongoose.model("Feedback", feedbackSchema);