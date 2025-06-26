const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const { decrypt } = require('../services/encryptionService');

// GET /api/messages/:chatId → Get all chat history
router.get('/:chatId', async (req, res) => {
  const { chatId } = req.params;

  try {
    const messages = await Message.find({ chatId }).sort({ timestamp: 1 });

    const decryptedMessages = messages.map(msg => ({
      _id: msg._id,
      chatId: msg.chatId,
      senderId: msg.senderId,
      receiverId: msg.receiverId,
      message: decrypt(msg.message),
      timestamp: msg.timestamp,
      status: msg.status || {}
    }));

    res.status(200).json(decryptedMessages);
  } catch (error) {
    console.error('❌ Error fetching messages:', error);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

module.exports = router;
