import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const ChatApp = () => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentChat, setCurrentChat] = useState(null);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [recentChats, setRecentChats] = useState([]);
  const [activeTab, setActiveTab] = useState('login');
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  useEffect(() => {
    if (!socket) return;
  
    const handleReceiveMessage = (message) => {
      const isInCurrentChat = message.chatId === currentChat?.chatId;
    
      if (isInCurrentChat && message.receiverId === user.userId) {
        setMessages((prev) => [...prev, message]);
    
        socket.emit('message_delivered', {
          messageId: message._id,
          receiverId: user.userId,
        });
    
        socket.emit('message_seen', { messageId: message._id });
      }
    
      // 🆕 Add sender to recentChats if not there
      const sender = {
        email: message.senderId,
        name: message.senderName || message.senderId.split('@')[0], // fallback if name not available
      };
    
      setRecentChats((prev) => {
        const exists = prev.find((chat) => chat.email === sender.email);
        if (!exists) {
          const updated = [sender, ...prev].slice(0, 10);
          localStorage.setItem('recentChats', JSON.stringify(updated));
          return updated;
        }
        return prev;
      });
    };
    
    
  
    const handleDelivered = ({ messageId, deliveredTo }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId
            ? {
                ...msg,
                status: {
                  ...msg.status,
                  deliveredTo: Array.isArray(deliveredTo) ? deliveredTo : [deliveredTo],
                },
              }
            : msg
        )
      );
    };
  
    const handleSeenUpdate = ({ messageId, seenBy }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId
            ? {
                ...msg,
                status: {
                  ...msg.status,
                  seenBy: Array.isArray(seenBy) ? seenBy : [seenBy],
                },
              }
            : msg
        )
      );
    };
  
    socket.on('receive_message', handleReceiveMessage);
    socket.on('message_delivered', handleDelivered);
    socket.on('message_seen_update', handleSeenUpdate);
  
    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('message_delivered', handleDelivered);
      socket.off('message_seen_update', handleSeenUpdate);
    };
  }, [socket, currentChat]);
  
  
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (token) {
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      setUser(userData);
      initializeSocket();
      loadRecentChats();
    }
  }, [token]);

  const loadRecentChats = () => {
    const saved = localStorage.getItem('recentChats');
    if (saved) {
      setRecentChats(JSON.parse(saved));
    }
  };

  const saveRecentChat = (chatUser) => {
    const updated = [chatUser, ...recentChats.filter(c => c.email !== chatUser.email)].slice(0, 10);
    setRecentChats(updated);
    localStorage.setItem('recentChats', JSON.stringify(updated));
  };

  const initializeSocket = () => {
    const newSocket = io('http://localhost:3000', {
      auth: { token }
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
      // Always register user after connection
      newSocket.emit('register_user');
    });

    const handleReceiveMessage = (message) => {
      if (message.chatId === currentChat?.chatId) {
        setMessages((prev) => [...prev, message]);
    
        // Emit to mark it as delivered if receiver is online
        socket.emit('message_seen', { messageId: message._id }); // Automatically mark as seen
      } else {
        // Optional: trigger unseen badge or notification
      }
    };
    

    newSocket.on('message_delivered', (data) => {
      setMessages(prev => prev.map(msg => 
        msg._id === data.messageId 
          ? { ...msg, status: 'delivered' }
          : msg
      ));
    });

    newSocket.on('message_seen_update', (data) => {
      setMessages(prev => prev.map(msg => 
        msg._id === data.messageId 
          ? { ...msg, status: 'seen' }
          : msg
      ));
    });

    newSocket.on('error_message', (error) => {
      setError(error.error);
    });

    setSocket(newSocket);

    return () => newSocket.disconnect();
  };

  const handleAuth = async (type) => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`http://localhost:3000/api/auth/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        if (type === 'login') {
          localStorage.setItem('token', data.token);
          localStorage.setItem('userData', JSON.stringify({
            userId: data.userId,
            name: data.name
          }));
          setToken(data.token);
          setUser({ userId: data.userId, name: data.name });
        } else {
          setActiveTab('login');
          setError('Registration successful! Please login.');
        }
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async () => {
    if (!searchEmail.trim()) return;
    
    setSearchLoading(true);
    try {
      // Mock search - replace with actual API call to your backend
      // You can add a route like GET /api/users/search?email=...
      const response = await fetch(`http://localhost:3000/api/users/search?email=${searchEmail}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const users = await response.json();
        setSearchResults(users);
      } else {
        // Fallback - create user object if email format is valid
        if (searchEmail.includes('@')) {
          setSearchResults([{
            email: searchEmail,
            name: searchEmail.split('@')[0],
            online: false
          }]);
        } else {
          setSearchResults([]);
        }
      }
    } catch (err) {
      // Fallback for demo
      if (searchEmail.includes('@')) {
        setSearchResults([{
          email: searchEmail,
          name: searchEmail.split('@')[0],
          online: false
        }]);
      } else {
        setSearchResults([]);
      }
    } finally {
      setSearchLoading(false);
    }
  };

  const loadMessages = async (chatId) => {
    if (!token) return;
    
    try {
      const response = await fetch(`http://localhost:3000/api/messages/${chatId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !currentChat || !socket) return;

    const chatId = [user.userId, currentChat.email].sort().join('_');
    
    const messageData = {
      message: newMessage,
      chatId,
      senderId: user.userId,
      receiverId: currentChat.email
    };

    socket.emit('send_message', messageData);
    
    setMessages(prev => [...prev, {
      _id: Date.now().toString(),
      ...messageData,
      timestamp: new Date(),
      status: 'sending'
    }]);
    
    setNewMessage('');
    inputRef.current?.focus();
  };

  const markAsSeen = (messageId) => {
    const msg = messages.find(m => m._id === messageId);
    if (msg && !msg.status?.seenBy?.includes(user.userId)) {
      socket.emit('message_seen', { messageId });
    }
  };
  

  const startChat = (selectedUser) => {
    setCurrentChat(selectedUser);
    saveRecentChat(selectedUser);
    const chatId = [user.userId, selectedUser.email].sort().join('_');
    loadMessages(chatId);
    setShowSearch(false);
    setSearchEmail('');
    setSearchResults([]);
  };

  const logout = () => {
    if (socket) socket.disconnect();
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    setToken(null);
    setUser(null);
    setMessages([]);
    setCurrentChat(null);
    setRecentChats([]);
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'sending': return '⏳';
      case 'delivered': return '✓';
      case 'seen': return '✓✓';
      default: return '';
    }
  };

  if (!user) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '20px'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '40px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          width: '100%',
          maxWidth: '450px'
        }}>
          <div style={{
            textAlign: 'center',
            marginBottom: '30px'
          }}>
            <h1 style={{
              fontSize: '32px',
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '8px'
            }}>ChatApp</h1>
            <p style={{ color: '#6b7280', fontSize: '16px' }}>
              Connect and chat in real-time
            </p>
          </div>

          <div style={{
            display: 'flex',
            marginBottom: '30px',
            borderRadius: '12px',
            background: '#f3f4f6',
            padding: '4px'
          }}>
            {['login', 'register'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: 'none',
                  borderRadius: '8px',
                  background: activeTab === tab ? 'white' : 'transparent',
                  color: activeTab === tab ? '#1f2937' : '#6b7280',
                  fontWeight: activeTab === tab ? '600' : '400',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textTransform: 'capitalize'
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {error && (
            <div style={{
              background: '#fef2f2',
              color: '#dc2626',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <div>
            {activeTab === 'register' && (
              <div style={{ marginBottom: '20px' }}>
                <input
                  type="text"
                  placeholder="Full Name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '16px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
              </div>
            )}
            
            <div style={{ marginBottom: '20px' }}>
              <input
                type="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
            </div>
            
            <div style={{ marginBottom: '30px' }}>
              <input
                type="password"
                placeholder="Password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                onKeyPress={(e) => e.key === 'Enter' && handleAuth(activeTab)}
                style={{
                  width: '100%',
                  padding: '16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
            </div>
            
            <button
              onClick={() => handleAuth(activeTab)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '16px',
                background: loading ? '#9ca3af' : 'linear-gradient(135deg, #667eea, #764ba2)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                textTransform: 'capitalize'
              }}
            >
              {loading ? 'Processing...' : activeTab}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: '#f9fafb'
    }}>
      {/* Sidebar */}
      <div style={{
        width: '400px',
        minWidth: '350px',
        background: 'white',
        borderRight: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e5e7eb',
          background: 'linear-gradient(135deg, #667eea, #764ba2)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '15px'
          }}>
            <div>
              <h2 style={{ color: 'white', margin: 0, fontSize: '20px', fontWeight: '600' }}>
                {user.name}
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.8)', margin: '4px 0 0 0', fontSize: '14px' }}>
                {user.userId}
              </p>
            </div>
            <button
              onClick={logout}
              style={{
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Logout
            </button>
          </div>
          
          {/* Search Bar */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="email"
              placeholder="Search by email..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchUsers()}
              style={{
                flex: 1,
                padding: '12px 16px',
                border: 'none',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.9)',
                fontSize: '14px',
                outline: 'none'
              }}
            />
            <button
              onClick={searchUsers}
              disabled={searchLoading}
              style={{
                padding: '12px 16px',
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              {searchLoading ? '...' : '🔍'}
            </button>
          </div>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div style={{
            borderBottom: '1px solid #e5e7eb',
            maxHeight: '200px',
            overflowY: 'auto'
          }}>
            <div style={{ padding: '12px 20px 8px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>
              SEARCH RESULTS
            </div>
            {searchResults.map(contact => (
              <div
                key={contact.email}
                onClick={() => startChat(contact)}
                style={{
                  padding: '12px 20px',
                  cursor: 'pointer',
                  background: '#f8fafc',
                  borderBottom: '1px solid #f1f5f9',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = '#e2e8f0'}
                onMouseLeave={(e) => e.target.style.background = '#f8fafc'}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: '600',
                    marginRight: '12px',
                    fontSize: '14px'
                  }}>
                    {contact.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '500', color: '#1f2937', marginBottom: '2px', fontSize: '14px' }}>
                      {contact.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {contact.email}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recent Chats */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <div style={{ padding: '16px 20px 12px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>
            RECENT CHATS
          </div>
          {recentChats.length === 0 ? (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: '#9ca3af'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>💬</div>
              <p style={{ margin: 0, fontSize: '14px' }}>No recent chats</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>Search for users by email to start chatting</p>
            </div>
          ) : (
            recentChats.map(contact => (
              <div
                key={contact.email}
                onClick={() => startChat(contact)}
                style={{
                  padding: '16px 20px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f3f4f6',
                  background: currentChat?.email === contact.email ? '#f0f9ff' : 'transparent',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (currentChat?.email !== contact.email) {
                    e.target.style.background = '#f9fafb';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentChat?.email !== contact.email) {
                    e.target.style.background = 'transparent';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: '600',
                    marginRight: '12px'
                  }}>
                    {contact.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '500', color: '#1f2937', marginBottom: '2px' }}>
                      {contact.name}
                    </div>
                    <div style={{ fontSize: '14px', color: '#6b7280' }}>
                      {contact.email}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {currentChat ? (
          <>
            {/* Chat Header */}
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #e5e7eb',
              background: 'white',
              display: 'flex',
              alignItems: 'center'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: '600',
                marginRight: '12px'
              }}>
                {currentChat.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 style={{ margin: 0, color: '#1f2937', fontSize: '18px', fontWeight: '600' }}>
                  {currentChat.name}
                </h3>
                <p style={{ margin: '2px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
                  {currentChat.email}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '20px',
              background: '#f9fafb'
            }}>
              {messages.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  color: '#9ca3af',
                  marginTop: '40px'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>💬</div>
                  <p style={{ margin: 0, fontSize: '16px' }}>No messages yet</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '14px' }}>Start the conversation!</p>
                </div>
              ) : (
                messages.map((message) => {
                  const isOwn = message.senderId === user.userId;
                  const isSeen = isOwn && message.status?.seenBy?.includes(currentChat.userId);
                  const isDelivered = isOwn && message.status?.deliveredTo?.includes(currentChat.userId);
                  
const statusIcon = isSeen ? '👁️' : isDelivered ? '✅' : '⏳';

                  return (
                    <div
                      key={message._id}
                      style={{
                        display: 'flex',
                        justifyContent: isOwn ? 'flex-end' : 'flex-start',
                        marginBottom: '16px'
                      }}
                      onMouseEnter={() => !isOwn && markAsSeen(message._id)}
                    >
                      <div style={{
                        maxWidth: '70%',
                        padding: '12px 16px',
                        borderRadius: '18px',
                        background: isOwn 
                          ? 'linear-gradient(135deg, #667eea, #764ba2)' 
                          : 'white',
                        color: isOwn ? 'white' : '#1f2937',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        position: 'relative',
                        wordBreak: 'break-word'
                      }}>
                        <div style={{ marginBottom: '4px' }}>
                          {message.message}
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '12px',
                          color: isOwn ? 'rgba(255,255,255,0.8)' : '#9ca3af',
                          marginTop: '4px'
                        }}>
                          <span>{formatTime(message.timestamp)}</span>
                
                          {isOwn && (
                            <span style={{ marginLeft: '8px' }}>
                              {statusIcon}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div style={{
              padding: '20px',
              borderTop: '1px solid #e5e7eb',
              background: 'white'
            }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: '24px',
                    outline: 'none',
                    fontSize: '16px',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  style={{
                    padding: '12px 20px',
                    background: newMessage.trim() 
                      ? 'linear-gradient(135deg, #667eea, #764ba2)' 
                      : '#e5e7eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '24px',
                    cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
                    fontWeight: '600',
                    transition: 'all 0.2s'
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f9fafb'
          }}>
            <div style={{ textAlign: 'center', color: '#6b7280' }}>
              <div style={{
                width: '80px',
                height: '80px',
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                fontSize: '32px'
              }}>
                💬
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', color: '#1f2937' }}>
                Welcome to ChatApp
              </h3>
              <p style={{ margin: 0, fontSize: '16px' }}>
                Search for users by email to start chatting
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatApp;