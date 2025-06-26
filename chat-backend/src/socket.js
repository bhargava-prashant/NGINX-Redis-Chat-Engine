
const Message       = require('../models/Message');
const User          = require('../models/User');
const redisClient   = require('./redisClient');
const { encrypt }   = require('../services/encryptionService');
const jwt           = require('jsonwebtoken');

const JWT_SECRET    = process.env.JWT_SECRET;
const userSocketMap = {}; // email → socket.id

// 🔒 JWT middleware
function verifySocketJWT(socket, next) {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return next(new Error('Unauthorized: No token provided'));

  try {
    socket.user = jwt.verify(token, JWT_SECRET); // { userId, name }
    next();
  } catch {
    next(new Error('Unauthorized: Invalid token'));
  }
}

function handleSocket(io) {
  io.use(verifySocketJWT);

  io.on('connection', (socket) => {
    console.log('🔌 Connected:', socket.id);

    // ------------------------- REGISTER -------------------------
socket.on('register_user', async () => {
    const userId = socket.user.userId; // email from JWT
    userSocketMap[userId] = socket.id;
  
    console.log(`✅ [REGISTER] User connected: ${userId} → Socket ID: ${socket.id}`);
  
    try {
      const updatedUser = await User.findOneAndUpdate(
        { email: userId },
        { socketId: socket.id, online: true, lastSeen: new Date() },
        { new: true }
      );
  
      if (updatedUser) {
        console.log(`🟢 [DB_UPDATED] Marked ${userId} as online in DB`);
      } else {
        console.warn(`⚠️ [DB_MISSING] No user found for email: ${userId}`);
      }
  
      const pendingKey = `pending:${userId}`;
      const offlineMsgs = await redisClient.lRange(pendingKey, 0, -1);
  
      for (const raw of offlineMsgs) {
        const msg = JSON.parse(raw);
        socket.emit('receive_message', msg);
        console.log(`📤 [REDIS_DELIVERED] Message ${msg._id} → ${userId}`);
      }
  
      if (offlineMsgs.length) {
        await redisClient.del(pendingKey);
        console.log(`🧹 [REDIS_CLEARED] ${offlineMsgs.length} messages cleared for ${userId}`);
      } else {
        console.log(`📭 [REDIS_EMPTY] No pending messages for ${userId}`);
      }
  
    } catch (err) {
      console.error(`❌ [REGISTER_ERROR] Failed to register ${userId}:`, err);
    }
  });
  

    // ------------------------ SEND MESSAGE ----------------------
    socket.on('send_message', async (data) => {
      try {
        const { message, chatId, senderId, receiverId } = data;
        if (!message || !chatId || !senderId || !receiverId) {
          socket.emit('error_message', { error: 'Missing required fields.' });
          return;
        }

        const encrypted = encrypt(message);
        const newMsg = await Message.create({
          chatId, senderId, receiverId, message: encrypted
        });

        const payload = {
          _id: newMsg._id,
          chatId,
          senderId,
          receiverId,
          message,
          timestamp: newMsg.timestamp
        };

        const rSocket = userSocketMap[receiverId];
        if (rSocket) {
          // Receiver online — deliver message
          io.to(rSocket).emit('receive_message', payload);

          await Message.findByIdAndUpdate(newMsg._id, {
            $addToSet: { 'status.deliveredTo': receiverId }
          });

          // Notify sender about delivery
          const sSocket = userSocketMap[senderId];
          if (sSocket) {
            io.to(sSocket).emit('message_delivered', {
              messageId: newMsg._id,
              deliveredTo: [receiverId]
            });
          }

          console.log(`✅ [DELIVERED] Message ${newMsg._id} sent from ${senderId} to ${receiverId} (online)`);
        } else {
          // Receiver offline — store in Redis
          await redisClient.rPush(`pending:${receiverId}`, JSON.stringify(payload));
          console.log(`💾 [REDIS] Message ${newMsg._id} stored for ${receiverId} (offline)`);
        }
      } catch (err) {
        console.error('🔥 send_message error:', err);
        socket.emit('error_message', { error: 'Internal server error.' });
      }
    });

    // ------------------------ SEEN MESSAGE ----------------------
    socket.on('message_seen', async ({ messageId }) => {
      const viewer = socket.user.userId;
      try {
        const msg = await Message.findByIdAndUpdate(
          messageId,
          { $addToSet: { 'status.seenBy': viewer } },
          { new: true }
        );

        const sSocket = userSocketMap[msg.senderId];
        if (sSocket) {
          io.to(sSocket).emit('message_seen_update', {
            messageId,
            seenBy: msg.status.seenBy
          });
        }
        console.log(`👁️ [SEEN] Message ${messageId} seen by ${viewer}`);
      } catch (err) {
        console.error('🔴 message_seen error:', err);
      }
    });

    // ------------------------ DISCONNECT ------------------------
    socket.on('disconnect', async () => {
      const userId = socket.user?.userId;
      if (userId) {
        await User.findOneAndUpdate(
          { email: userId },
          { online: false, lastSeen: new Date() }
        );
        delete userSocketMap[userId];
        console.log('❌ Disconnected:', userId);
      }
    });
  });
}

module.exports = { handleSocket };
