const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const { decrypt } = require('../services/encryptionService');

// 📥 GET /api/messages/:chatId → Get all messages in a chat
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
      status: msg.status || { deliveredTo: [], seenBy: [] }
    }));

    res.status(200).json(decryptedMessages);
  } catch (error) {
    console.error('❌ Error fetching messages:', error);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

// 👁️ POST /api/messages/seen/:messageId → Mark message as seen by user
router.post('/seen/:messageId', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    await Message.findByIdAndUpdate(req.params.messageId, {
      $addToSet: { "status.seenBy": userId }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error marking message as seen:', err);
    res.status(500).json({ message: 'Failed to mark as seen' });
  }
});

// 📬 POST /api/messages/delivered/:messageId → Mark as delivered
router.post('/delivered/:messageId', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    await Message.findByIdAndUpdate(req.params.messageId, {
      $addToSet: { "status.deliveredTo": userId }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error marking message as delivered:', err);
    res.status(500).json({ message: 'Failed to mark as delivered' });
  }
});

module.exports = router;
