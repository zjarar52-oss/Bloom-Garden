
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// 简单轻量的本地文件数据库
const DB_FILE = path.join(__dirname, 'cloud_db.json');

const initDB = () => {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({
      moments: [],
      garden: { roses: [], streak: 0, lastCollectionDate: null }
    }));
  }
};
initDB();

const readDB = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

let clients = [];

// SSE (Server-Sent Events) 实时数据流端点
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // 客户端一连接，立刻下发当前的完整云端数据
  res.write(`data: ${JSON.stringify({ type: 'INIT', payload: readDB() })}\n\n`);
  
  clients.push(res);
  req.on('close', () => {
    clients = clients.filter(c => c !== res);
  });
});

// 将变更广播给所有在线用户
const broadcast = (type, payload) => {
  clients.forEach(c => c.write(`data: ${JSON.stringify({ type, payload })}\n\n`));
};

app.get('/api/data', (req, res) => res.json(readDB()));

app.post('/api/moments', (req, res) => {
  const db = readDB();
  db.moments = req.body;
  writeDB(db);
  broadcast('MOMENTS', db.moments);
  res.json({ success: true });
});

app.post('/api/garden', (req, res) => {
  const db = readDB();
  db.garden = req.body;
  writeDB(db);
  broadcast('GARDEN', db.garden);
  res.json({ success: true });
});

// 使用 3001 端口避免与前端 Vite(3000/5173) 冲突
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 情绪补给站·云端同步服务已启动: http://localhost:${PORT}`);
});
