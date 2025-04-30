const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  maxHttpBufferSize: 1e8 // 100MB
});

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

const users = {};
let messageCounter = 0;
let hostSocketId = null;
let chatPassword = 'love123'; // Initial default password

io.on('connection', (socket) => {
  socket.on('join request', (data) => {
    const { username, password } = data;
    if (!hostSocketId) {
      // First user becomes the host
      hostSocketId = socket.id;
      users[socket.id] = username;
      console.log(`${username} connected as host`);
      socket.emit('join success', { isHost: true });
      io.emit('user joined', username);
    } else {
      // Non-host users must provide the correct password
      if (password === chatPassword) {
        users[socket.id] = username;
        console.log(`${username} connected`);
        socket.emit('join success', { isHost: false });
        io.emit('user joined', username);
      } else {
        socket.emit('join error', 'Incorrect password, my love!');
      }
    }
  });

  socket.on('set password', (newPassword) => {
    if (socket.id === hostSocketId) {
      chatPassword = newPassword;
      console.log(`Host set new password: ${chatPassword}`);
      socket.emit('password updated', chatPassword);
    } else {
      socket.emit('join error', 'Only the host can set a new password!');
    }
  });

  socket.on('chat message', (msg) => {
    msg.id = messageCounter++;
    io.emit('chat message', msg);
  });

  socket.on('file message', (fileMsg) => {
    fileMsg.id = messageCounter++;
    console.log('Received file message:', fileMsg.name, fileMsg.type);
    io.emit('file message', fileMsg);
  });

  socket.on('voice message', (voiceMsg) => {
    voiceMsg.id = messageCounter++;
    console.log('Received voice message from:', voiceMsg.sender);
    io.emit('voice message', voiceMsg);
  });

  socket.on('delete message', (messageId) => {
    io.emit('delete message', messageId);
  });

  socket.on('reaction', (reactionData) => {
    io.emit('reaction', reactionData);
  });

  socket.on('typing', (username) => {
    socket.broadcast.emit('typing', username);
  });

  socket.on('stop typing', (username) => {
    socket.broadcast.emit('stop typing', username);
  });

  socket.on('disconnect', () => {
    const username = users[socket.id];
    if (username) {
      console.log(`${username} disconnected`);
      io.emit('user left', username);
      if (socket.id === hostSocketId) {
        hostSocketId = null; // Reset host if they disconnect
        console.log('Host disconnected, next user can become host');
      }
      delete users[socket.id];
    }
  });
});

http.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
