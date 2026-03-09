require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

(async()=>{
 await mongoose.connect(process.env.MONGO_URI);

 const email="admin@portal.com";
 const password="Admin123!";
 const matric="ADMIN001";

 const exists = await User.findOne({ email });
 if(exists){
   console.log("Admin already exists");
   process.exit();
 }

 const hash = await bcrypt.hash(password,12);

 await User.create({
   email,
   matric,
   passwordHash:hash,
   role:"admin"
 });

 console.log("Admin created");
 process.exit();
})();