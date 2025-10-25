class VideoCallApp {
  constructor() {
    this.localStream = null;
    this.peer = null;
    this.currentCall = null;
    this.isVideoEnabled = true;
    this.isAudioEnabled = true;
    this.roomId = null;
    this.peerConnection = null;
    this.useDirectConnection = false;
    
    this.initializeElements();
    this.bindEvents();
    this.initializeWithFallback();
  }

  async initializeWithFallback() {
    try {
      await this.initializePeer();
    } catch (error) {
      console.log('PeerJS недоступен, переключаемся на локальный режим...');
      this.showNotification('PeerJS сервер недоступен. Переключение на локальный режим.', 'error');
      this.switchToLocalMode();
    }
  }

  switchToLocalMode() {
    // Скрываем кнопки создания/присоединения к комнатам
    this.createRoomBtn.style.display = 'none';
    this.joinRoomBtn.style.display = 'none';
    
    // Показываем сообщение о локальном режиме
    const welcomeCard = document.querySelector('.welcome-card');
    const localModeInfo = document.createElement('div');
    localModeInfo.innerHTML = `
      <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <h3 style="color: #856404; margin-bottom: 10px;">🔧 Локальный режим</h3>
        <p style="color: #856404; margin-bottom: 15px;">
          PeerJS сервер недоступен. Вы можете протестировать камеру и микрофон локально.
        </p>
        <a href="simple.html" class="btn btn-primary">🧪 Тест камеры</a>
        <button onclick="location.reload()" class="btn btn-secondary" style="margin-left: 10px;">🔄 Попробовать снова</button>
      </div>
    `;
    welcomeCard.appendChild(localModeInfo);
  }

  initializeElements() {
    // Screen elements
    this.welcomeScreen = document.getElementById('welcomeScreen');
    this.callScreen = document.getElementById('callScreen');
    
    // Video elements
    this.localVideo = document.getElementById('localVideo');
    this.remoteVideo = document.getElementById('remoteVideo');
    
    // Welcome screen elements
    this.createRoomBtn = document.getElementById('createRoomBtn');
    this.joinRoomBtn = document.getElementById('joinRoomBtn');
    this.joinForm = document.getElementById('joinForm');
    this.roomIdInput = document.getElementById('roomIdInput');
    this.joinBtn = document.getElementById('joinBtn');
    this.cancelJoinBtn = document.getElementById('cancelJoinBtn');
    
    // Call screen elements
    this.toggleVideoBtn = document.getElementById('toggleVideo');
    this.toggleAudioBtn = document.getElementById('toggleAudio');
    this.endCallBtn = document.getElementById('endCallBtn');
    this.callStatus = document.getElementById('callStatus');
    this.roomIdDisplay = document.getElementById('roomIdDisplay');
    
    // Notifications
    this.notifications = document.getElementById('notifications');
  }

  bindEvents() {
    // Welcome screen events
    this.createRoomBtn.addEventListener('click', () => this.createRoom());
    this.joinRoomBtn.addEventListener('click', () => this.showJoinForm());
    this.joinBtn.addEventListener('click', () => this.joinRoom());
    this.cancelJoinBtn.addEventListener('click', () => this.hideJoinForm());
    
    // Call screen events
    this.toggleVideoBtn.addEventListener('click', () => this.toggleVideo());
    this.toggleAudioBtn.addEventListener('click', () => this.toggleAudio());
    this.endCallBtn.addEventListener('click', () => this.endCall());
    
    // Room ID input
    this.roomIdInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.joinRoom();
    });
  }

  async initializePeer() {
    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ];

    // Пробуем разные конфигурации PeerJS
    const configs = [
      // Конфигурация 1: Без указания хоста (использует дефолтный)
      {
        config: { 
          iceServers,
          iceCandidatePoolSize: 10
        }
      },
      // Конфигурация 2: С явным указанием хоста
      {
        host: '0.peerjs.com',
        port: 443,
        path: '/',
        secure: true,
        config: { iceServers }
      },
      // Конфигурация 3: Альтернативный хост
      {
        host: 'peerjs.com',
        port: 443,
        path: '/',
        secure: true,
        config: { iceServers }
      }
    ];

    for (let i = 0; i < configs.length; i++) {
      try {
        console.log(`Попытка конфигурации ${i + 1}/${configs.length}...`);
        
        this.peer = new Peer(configs[i]);

        this.peer.on('open', (id) => {
          console.log('Peer ID получен:', id);
          this.showNotification('Подключение установлено', 'success');
        });

        this.peer.on('call', (call) => {
          console.log('Входящий звонок');
          this.handleIncomingCall(call);
        });

        this.peer.on('error', (error) => {
          console.error('Peer error:', error);
          this.handlePeerError(error);
        });

        this.peer.on('disconnected', () => {
          console.log('Соединение потеряно, переподключение...');
          this.showNotification('Соединение потеряно, переподключение...', 'error');
          this.peer.reconnect();
        });

        // Ждем получения ID с более коротким таймаутом
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Connection timeout'));
          }, 8000); // Уменьшили таймаут до 8 секунд

          this.peer.on('open', (id) => {
            clearTimeout(timeout);
            resolve(id);
          });

          this.peer.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        });

        // Если дошли сюда, значит подключение успешно
        console.log(`Конфигурация ${i + 1} успешна!`);
        return;

      } catch (error) {
        console.error(`Конфигурация ${i + 1} не удалась:`, error);
        
        if (this.peer) {
          this.peer.destroy();
          this.peer = null;
        }

        if (i === configs.length - 1) {
          // Все конфигурации не удались
          throw new Error('All configurations failed');
        }
      }
    }
  }

  showRetryButton() {
    const retryBtn = document.createElement('button');
    retryBtn.textContent = '🔄 Попробовать снова';
    retryBtn.className = 'btn btn-primary';
    retryBtn.style.marginTop = '20px';
    retryBtn.onclick = () => {
      retryBtn.remove();
      this.initializePeer();
    };
    
    const welcomeCard = document.querySelector('.welcome-card');
    welcomeCard.appendChild(retryBtn);
  }

  handlePeerError(error) {
    console.error('Peer error details:', error);
    
    let errorMessage = 'Ошибка подключения';
    
    switch (error.type) {
      case 'network':
        errorMessage = 'Проблема с сетью. Проверьте интернет-соединение.';
        break;
      case 'peer-unavailable':
        errorMessage = 'Собеседник недоступен. Проверьте ID комнаты.';
        break;
      case 'connection-closed':
        errorMessage = 'Соединение закрыто. Попробуйте переподключиться.';
        break;
      case 'server-error':
        errorMessage = 'Ошибка сервера. Попробуйте позже.';
        break;
      case 'unavailable-id':
        errorMessage = 'ID недоступен. Попробуйте создать новую комнату.';
        break;
      case 'invalid-id':
        errorMessage = 'Неверный ID комнаты. Проверьте правильность ввода.';
        break;
      default:
        errorMessage = `Ошибка: ${error.message}`;
    }
    
    this.showNotification(errorMessage, 'error');
  }

  // Альтернативный метод без PeerJS сервера (для локального использования)
  async initializeDirectConnection() {
    try {
      console.log('Инициализация прямого WebRTC соединения...');
      
      // Создаем RTCPeerConnection
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      };
      
      this.peerConnection = new RTCPeerConnection(configuration);
      
      // Добавляем локальный поток
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          this.peerConnection.addTrack(track, this.localStream);
        });
      }
      
      // Обработка входящих потоков
      this.peerConnection.ontrack = (event) => {
        console.log('Получен удаленный поток');
        this.remoteVideo.srcObject = event.streams[0];
      };
      
      // Обработка ICE кандидатов
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          // В реальном приложении здесь бы отправляли кандидата через сигнальный сервер
          console.log('ICE candidate:', event.candidate);
        }
      };
      
      this.showNotification('Прямое соединение инициализировано', 'success');
      
    } catch (error) {
      console.error('Failed to initialize direct connection:', error);
      this.showNotification('Не удалось инициализировать прямое соединение', 'error');
    }
  }

  async createRoom() {
    try {
      await this.getUserMedia();
      this.roomId = this.peer.id;
      this.roomIdDisplay.textContent = `ID комнаты: ${this.roomId}`;
      this.callStatus.textContent = 'Ожидание подключения...';
      this.showCallScreen();
      this.showNotification('Комната создана! Поделитесь ID с собеседником', 'success');
    } catch (error) {
      console.error('Failed to create room:', error);
      this.showNotification('Не удалось создать комнату', 'error');
    }
  }

  showJoinForm() {
    this.joinForm.classList.remove('hidden');
    this.joinRoomBtn.style.display = 'none';
  }

  hideJoinForm() {
    this.joinForm.classList.add('hidden');
    this.joinRoomBtn.style.display = 'inline-block';
    this.roomIdInput.value = '';
  }

  async joinRoom() {
    const roomId = this.roomIdInput.value.trim();
    if (!roomId) {
      this.showNotification('Введите ID комнаты', 'error');
      return;
    }

    try {
      await this.getUserMedia();
      this.roomId = roomId;
      this.roomIdDisplay.textContent = `ID комнаты: ${this.roomId}`;
      this.callStatus.textContent = 'Подключение...';
      this.showCallScreen();
      
      // Инициируем звонок
      this.currentCall = this.peer.call(roomId, this.localStream);
      this.handleOutgoingCall(this.currentCall);
      
    } catch (error) {
      console.error('Failed to join room:', error);
      this.showNotification('Не удалось присоединиться к комнате', 'error');
    }
  }

  async getUserMedia() {
    if (!this.localStream) {
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        this.localVideo.srcObject = this.localStream;
      } catch (error) {
        console.error('Failed to get user media:', error);
        this.showNotification('Не удалось получить доступ к камере и микрофону', 'error');
        throw error;
      }
    }
  }

  handleIncomingCall(call) {
    this.currentCall = call;
    this.callStatus.textContent = 'Входящий звонок...';
    
    // Автоматически принимаем звонок
    call.answer(this.localStream);
    
    call.on('stream', (remoteStream) => {
      this.remoteVideo.srcObject = remoteStream;
      this.callStatus.textContent = 'Соединение установлено';
      this.showNotification('Соединение установлено!', 'success');
    });

    call.on('close', () => {
      this.handleCallEnd();
    });

    call.on('error', (error) => {
      console.error('Call error:', error);
      this.showNotification('Ошибка звонка: ' + error.message, 'error');
    });
  }

  handleOutgoingCall(call) {
    call.on('stream', (remoteStream) => {
      this.remoteVideo.srcObject = remoteStream;
      this.callStatus.textContent = 'Соединение установлено';
      this.showNotification('Соединение установлено!', 'success');
    });

    call.on('close', () => {
      this.handleCallEnd();
    });

    call.on('error', (error) => {
      console.error('Call error:', error);
      this.showNotification('Ошибка звонка: ' + error.message, 'error');
    });
  }

  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        this.isVideoEnabled = videoTrack.enabled;
        this.toggleVideoBtn.textContent = this.isVideoEnabled ? '📹' : '📹';
        this.toggleVideoBtn.classList.toggle('muted', !this.isVideoEnabled);
      }
    }
  }

  toggleAudio() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        this.isAudioEnabled = audioTrack.enabled;
        this.toggleAudioBtn.textContent = this.isAudioEnabled ? '🎤' : '🎤';
        this.toggleAudioBtn.classList.toggle('muted', !this.isAudioEnabled);
      }
    }
  }

  endCall() {
    if (this.currentCall) {
      this.currentCall.close();
    }
    this.handleCallEnd();
  }

  handleCallEnd() {
    this.currentCall = null;
    this.remoteVideo.srcObject = null;
    this.showWelcomeScreen();
    this.showNotification('Звонок завершен', 'success');
  }

  showWelcomeScreen() {
    this.welcomeScreen.classList.add('active');
    this.callScreen.classList.remove('active');
    this.hideJoinForm();
  }

  showCallScreen() {
    this.welcomeScreen.classList.remove('active');
    this.callScreen.classList.add('active');
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    this.notifications.appendChild(notification);
    
    // Автоматически удаляем уведомление через 5 секунд
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
  }
}

// Инициализируем приложение когда DOM загружен
document.addEventListener('DOMContentLoaded', () => {
  new VideoCallApp();
});