const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  chatId: { type: String, required: true },
  senderId: { type: String, required: true },
  receiverId: { type: String, required: true },
  message: {
    iv: { type: String, required: true },
    content: { type: String, required: true }
  },
  status: {
    deliveredTo: { type: [String], default: [] },
    seenBy: { type: [String], default: [] }
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Message', MessageSchema);
