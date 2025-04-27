const socket = io();
const chatBox = document.getElementById('chat-box');
const messageInput = document.getElementById('message-input');
const nameInput = document.getElementById('name-input');
const passwordInput = document.getElementById('password-input');
const fileInput = document.getElementById('file-input');
const namePrompt = document.getElementById('name-prompt');
const chatContainer = document.getElementById('chat-container');
const typingIndicator = document.getElementById('typing-indicator');
const themeToggle = document.getElementById('theme-toggle');
const micBtn = document.getElementById('mic-btn');
const hostControls = document.getElementById('host-controls');
const newPasswordInput = document.getElementById('new-password-input');
const shareLink = document.getElementById('share-link');
const sendSound = document.getElementById('send-sound');
const receiveSound = document.getElementById('receive-sound');
let userName = '';
let isTyping = false;
let mediaRecorder = null;
let audioChunks = [];
let isHost = false;

// Load theme from localStorage
const savedTheme = localStorage.getItem('theme') || 'light';
document.body.classList.add(savedTheme + '-theme');
themeToggle.textContent = savedTheme === 'light' ? '🌙' : '☀️';

// Auto-fill password from URL query parameter
const urlParams = new URLSearchParams(window.location.search);
const urlPassword = urlParams.get('password');
if (urlPassword) {
  passwordInput.value = urlPassword;
}

function toggleTheme() {
  const currentTheme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.body.classList.remove(currentTheme + '-theme');
  document.body.classList.add(newTheme + '-theme');
  localStorage.setItem('theme', newTheme);
  themeToggle.textContent = newTheme === 'light' ? '🌙' : '☀️';
}

function generateRandomPassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function generatePasswordAndLink() {
  let newPassword = newPasswordInput.value.trim();
  if (!newPassword) {
    newPassword = generateRandomPassword();
    newPasswordInput.value = newPassword;
  }
  socket.emit('set password', newPassword);
  socket.once('password updated', (password) => {
    const shareUrl = `${window.location.origin}/?password=${encodeURIComponent(password)}`;
    shareLink.textContent = `Share this link: ${shareUrl}`;
    shareLink.style.display = 'block';
  });
}

function enterChat() {
  const name = nameInput.value.trim();
  const password = passwordInput.value.trim();
  if (name && password) {
    socket.emit('join request', { username: name, password });
    socket.once('join success', (data) => {
      userName = name;
      isHost = data.isHost;
      namePrompt.style.display = 'none';
      chatContainer.style.display = 'flex';
      if (isHost) {
        hostControls.style.display = 'block';
      }
    });
    socket.once('join error', (error) => {
      alert(error);
    });
  } else {
    alert('Please enter your name and password, my love!');
  }
}

function sendMessage() {
  const message = messageInput.value.trim();
  if (message && userName) {
    socket.emit('chat message', {
      text: message,
      sender: userName,
      timestamp: new Date().toLocaleTimeString()
    });
    sendSound.play().catch(err => console.log('Error playing send sound:', err));
    messageInput.value = '';
    socket.emit('stop typing', userName);
    isTyping = false;
  }
}

function sendFile(file) {
  const reader = new FileReader();
  reader.onload = (event) => {
    console.log('File read successfully:', file.name, file.type, 'Size:', file.size);
    const fileData = {
      name: file.name,
      type: file.type,
      data: event.target.result,
      sender: userName,
      timestamp: new Date().toLocaleTimeString()
    };
    socket.emit('file message', fileData);
    sendSound.play().catch(err => console.log('Error playing send sound:', err));
  };
  reader.onerror = (err) => {
    console.error('Error reading file:', err);
  };
  reader.readAsDataURL(file);
}

function sendVoiceMessage() {
  const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
  const reader = new FileReader();
  reader.onload = (event) => {
    const voiceData = {
      data: event.target.result,
      sender: userName,
      timestamp: new Date().toLocaleTimeString()
    };
    socket.emit('voice message', voiceData);
    sendSound.play().catch(err => console.log('Error playing send sound:', err));
    micBtn.textContent = '🎙️';
    micBtn.classList.remove('recording');
    audioChunks = [];
    if (mediaRecorder) {
      mediaRecorder.stop();
      mediaRecorder = null;
    }
  };
  reader.readAsDataURL(audioBlob);
}

function toggleRecording() {
  if (!mediaRecorder) {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };
        mediaRecorder.onstop = sendVoiceMessage;
        mediaRecorder.start();
        micBtn.textContent = '⏹️';
        micBtn.classList.add('recording');
      })
      .catch(err => console.error('Error accessing microphone:', err));
  } else {
    if (mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
  }
}

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file && userName) {
    console.log('Selected file:', file.name, file.type, 'Size:', file.size);
    sendFile(file);
    fileInput.value = '';
  } else {
    console.log('No file selected or userName not set');
  }
});

nameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') enterChat();
});

messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

messageInput.addEventListener('input', () => {
  if (messageInput.value.trim() && !isTyping) {
    socket.emit('typing', userName);
    isTyping = true;
    typingIndicator.classList.add('typing-animation');
  } else if (!messageInput.value.trim() && isTyping) {
    socket.emit('stop typing', userName);
    isTyping = false;
    typingIndicator.classList.remove('typing-animation');
  }
});

function createMessageElement(msg, isSent, isFile = false, isVoice = false) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message');
  messageDiv.classList.add(isSent ? 'sent' : 'received');
  messageDiv.dataset.messageId = msg.id;

  const nameSpan = document.createElement('span');
  nameSpan.classList.add('name');
  nameSpan.textContent = msg.sender;
  messageDiv.appendChild(nameSpan);

  if (isFile) {
    if (msg.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = msg.data;
      messageDiv.appendChild(img);
    } else if (msg.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.src = msg.data;
      video.controls = true;
      video.style.maxWidth = '100%';
      messageDiv.appendChild(video);
    } else {
      const link = document.createElement('a');
      link.href = msg.data;
      link.download = msg.name;
      link.textContent = `Download ${msg.name}`;
      messageDiv.appendChild(link);
    }
  } else if (isVoice) {
    const audio = document.createElement('audio');
    audio.src = msg.data;
    audio.controls = true;
    messageDiv.appendChild(audio);
  } else {
    const textSpan = document.createElement('span');
    textSpan.textContent = msg.text;
    messageDiv.appendChild(textSpan);
  }

  const timestampSpan = document.createElement('span');
  timestampSpan.classList.add('timestamp');
  timestampSpan.textContent = msg.timestamp;
  messageDiv.appendChild(timestampSpan);

  const reactionsDiv = document.createElement('div');
  reactionsDiv.classList.add('reactions');
  messageDiv.appendChild(reactionsDiv);

  const reactBtn = document.createElement('span');
  reactBtn.textContent = '❤️';
  reactBtn.style.cursor = 'pointer';
  reactBtn.addEventListener('click', () => {
    socket.emit('reaction', {
      messageId: msg.id,
      reaction: '❤️',
      sender: userName
    });
  });
  messageDiv.appendChild(reactBtn);

  if (isSent) {
    const deleteBtn = document.createElement('button');
    deleteBtn.classList.add('delete-btn');
    deleteBtn.textContent = '🗑️';
    deleteBtn.addEventListener('click', () => {
      socket.emit('delete message', msg.id);
    });
    messageDiv.appendChild(deleteBtn);
  }

  return messageDiv;
}

socket.on('chat message', (msg) => {
  const isSent = msg.sender === userName;
  const messageDiv = createMessageElement(msg, isSent);
  chatBox.appendChild(messageDiv);
  chatBox.scrollTop = chatBox.scrollHeight;

  if (!isSent) {
    receiveSound.play().catch(err => console.log('Error playing receive sound:', err));
  }
});

socket.on('file message', (fileMsg) => {
  const isSent = fileMsg.sender === userName;
  const messageDiv = createMessageElement(fileMsg, isSent, true);
  chatBox.appendChild(messageDiv);
  chatBox.scrollTop = chatBox.scrollHeight;

  if (!isSent) {
    receiveSound.play().catch(err => console.log('Error playing receive sound:', err));
  }
});

socket.on('voice message', (voiceMsg) => {
  const isSent = voiceMsg.sender === userName;
  const messageDiv = createMessageElement(voiceMsg, isSent, false, true);
  chatBox.appendChild(messageDiv);
  chatBox.scrollTop = chatBox.scrollHeight;

  if (!isSent) {
    receiveSound.play().catch(err => console.log('Error playing receive sound:', err));
  }
});

socket.on('delete message', (messageId) => {
  const messageDiv = chatBox.querySelector(`[data-message-id="${messageId}"]`);
  if (messageDiv) {
    messageDiv.remove();
  }
});

socket.on('reaction', (reactionData) => {
  const messageDiv = chatBox.querySelector(`[data-message-id="${reactionData.messageId}"]`);
  if (messageDiv) {
    const reactionsDiv = messageDiv.querySelector('.reactions');
    const existingReaction = reactionsDiv.textContent.includes(reactionData.reaction);
    if (existingReaction) {
      reactionsDiv.textContent = reactionsDiv.textContent.replace(`${reactionData.reaction} ${reactionData.sender}`, '');
    } else {
      reactionsDiv.textContent += `${reactionData.reaction} ${reactionData.sender} `;
    }
  }
});

socket.on('user joined', (username) => {
  if (username !== userName) {
    const notificationDiv = document.createElement('div');
    notificationDiv.classList.add('notification');
    notificationDiv.textContent = `${username} joined the chat 💕`;
    chatBox.appendChild(notificationDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
  }
});

socket.on('user left', (username) => {
  const notificationDiv = document.createElement('div');
  notificationDiv.classList.add('notification');
  notificationDiv.textContent = `${username} left the chat 💔`;
  chatBox.appendChild(notificationDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
});

socket.on('typing', (username) => {
  if (username !== userName) {
    typingIndicator.style.display = 'block';
    typingIndicator.textContent = `${username} is typing`;
    typingIndicator.classList.add('typing-animation');
  }
});

socket.on('stop typing', (username) => {
  if (username !== userName) {
    typingIndicator.style.display = 'none';
    typingIndicator.classList.remove('typing-animation');
  }
});

socket.on('join error', (error) => {
  alert(error);
});
