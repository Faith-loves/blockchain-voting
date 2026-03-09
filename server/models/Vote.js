const mongoose = require("mongoose");

const voteSchema = new mongoose.Schema(
  {
    electionKey: { type: String, required: true },

    voterId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User"
    },

    voterMatric: { type: String, required: true },

    selections: [
      {
        positionId: String,
        candidateId: String
      }
    ],

    // Human-readable receipt
    receiptId: {
      type: String,
      required: true
    },

    // Cryptographic proof receipt
    receiptHash: {
      type: String,
      required: true,
      index: true
    }
  },
  { timestamps: true }
);


// ONE vote per voter per election
voteSchema.index(
  { electionKey: 1, voterId: 1 },
  { unique: true }
);


module.exports = mongoose.model("Vote", voteSchema);