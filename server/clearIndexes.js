const mongoose = require("mongoose");

mongoose.connect("mongodb://127.0.0.1:27017/blockchainVotingDB")
.then(async () => {
  const db = mongoose.connection.db;

  await db.collection("users").dropIndexes();

  console.log("Indexes cleared successfully");

  process.exit();
})
.catch(err=>{
  console.error("Error:", err);
  process.exit(1);
});