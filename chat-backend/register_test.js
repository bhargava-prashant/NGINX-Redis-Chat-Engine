const { io } = require("socket.io-client");

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJyZWV0QGV4YW1wbGUuY29tIiwibmFtZSI6IlJlZXQiLCJpYXQiOjE3NTA5MjI5NDcsImV4cCI6MTc1MTUyNzc0N30.ra4dzUIKaAQRoQoqPhloKkqCS7nwUK7ny4tCx_Gk-C0"; // from login
const userEmail = "reet@example.com"; // same user as in token

const socket = io("http://localhost:3000", {
  auth: {
    token
  }
});

socket.on("connect", () => {
  console.log("🟢 Connected as:", userEmail);
  
  // This will trigger your backend's `register_user` handler
  socket.emit("register_user");
});

socket.on("receive_message", (msg) => {
  console.log("📩 Got message from Redis or live:", msg);
});

socket.on("disconnect", () => {
  console.log("🔌 Disconnected");
});

socket.on("connect_error", (err) => {
  console.error("❌ Connect error:", err.message);
});
