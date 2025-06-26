const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, required: true, unique: true },
  password: String, // hashed
  socketId: String,
  online: { type: Boolean, default: false },
  lastSeen: { type: Date, default: null }
});

module.exports = mongoose.model('User', UserSchema);
