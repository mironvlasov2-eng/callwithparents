const WebSocket = require('ws');
const http = require('http');
const url = require('url');

// Создаем HTTP сервер
const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Хранилище комнат и соединений
const rooms = new Map();
const connections = new Map();

wss.on('connection', (ws, req) => {
  const query = url.parse(req.url, true).query;
  const roomId = query.room;
  const userId = query.user || Math.random().toString(36).substr(2, 9);
  
  console.log(`Новое подключение: ${userId} в комнату ${roomId}`);
  
  // Сохраняем соединение
  connections.set(userId, ws);
  
  // Добавляем в комнату
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  rooms.get(roomId).add(userId);
  
  // Отправляем список участников комнаты
  const participants = Array.from(rooms.get(roomId));
  ws.send(JSON.stringify({
    type: 'room-joined',
    room: roomId,
    participants: participants,
    userId: userId
  }));
  
  // Уведомляем других участников
  rooms.get(roomId).forEach(participantId => {
    if (participantId !== userId && connections.has(participantId)) {
      connections.get(participantId).send(JSON.stringify({
        type: 'user-joined',
        userId: userId,
        room: roomId
      }));
    }
  });
  
  // Обработка сообщений
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'offer':
        case 'answer':
        case 'ice-candidate':
          // Пересылаем сигнальные данные другим участникам
          rooms.get(roomId).forEach(participantId => {
            if (participantId !== userId && connections.has(participantId)) {
              connections.get(participantId).send(JSON.stringify({
                ...data,
                from: userId
              }));
            }
          });
          break;
          
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
      }
    } catch (error) {
      console.error('Ошибка обработки сообщения:', error);
    }
  });
  
  // Обработка отключения
  ws.on('close', () => {
    console.log(`Отключение: ${userId} из комнаты ${roomId}`);
    
    // Удаляем из комнаты
    if (rooms.has(roomId)) {
      rooms.get(roomId).delete(userId);
      
      // Уведомляем других участников
      rooms.get(roomId).forEach(participantId => {
        if (connections.has(participantId)) {
          connections.get(participantId).send(JSON.stringify({
            type: 'user-left',
            userId: userId,
            room: roomId
          }));
        }
      });
      
      // Удаляем пустую комнату
      if (rooms.get(roomId).size === 0) {
        rooms.delete(roomId);
      }
    }
    
    connections.delete(userId);
  });
  
  // Обработка ошибок
  ws.on('error', (error) => {
    console.error(`Ошибка WebSocket для ${userId}:`, error);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Сигнальный сервер запущен на порту ${PORT}`);
  console.log(`📡 WebSocket: ws://localhost:${PORT}`);
  console.log(`🌐 HTTP: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Остановка сервера...');
  server.close(() => {
    console.log('✅ Сервер остановлен');
    process.exit(0);
  });
});
