const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const userSchema = new Schema({
  emailid: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  phoneno: {
    type: Number,
    required: true,
  },
  role: {
    type: String,
    required: true,
  },
  rollno: {
    type: String,
    required: false,
  },
});

module.exports = mongoose.model("User", userSchema);
