const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
{
  email:{
    type:String,
    required:true,
    lowercase:true,
    trim:true,
    match:/^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },

  matric:{
    type:String,
    required:true,
    trim:true,
    uppercase:true,
    minlength:3,
    maxlength:20
  },

  passwordHash:{
    type:String,
    required:true,
    minlength:20
  },

  role:{                 // ← ADD THIS
    type:String,
    enum:["voter","admin"],
    default:"voter"
  }

},
{ timestamps:true }
);

userSchema.index({ email:1 }, { unique:true });
userSchema.index({ matric:1 }, { unique:true });

module.exports = mongoose.model("User", userSchema);