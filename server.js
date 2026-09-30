const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let systemState = {
  currentAgent: "COMMAND_HUB",
  currentTitle: "SYSTEM OPERATIONAL",
  currentMessage: "All autonomous multi-agent pipelines active.",
  themeAccent: "0x07FF",
  lastAlertLevel: "INFO",
  hardwareTelemetry: { rssi: -40, heap: 214832, uptime: 0 },
  cryptoRates: { btc: "88,450", xrp: "2.415", aero: "1.240" }
};

app.post('/api/v1/event', (req, res) => {
  const { agent, title, message, level, theme } = req.body;
  if (agent) systemState.currentAgent = agent;
  if (title) systemState.currentTitle = title;
  if (message) systemState.currentMessage = message;
  if (level) systemState.lastAlertLevel = level;
  if (theme) systemState.themeAccent = theme;

  io.emit('display_update', systemState);
  res.status(200).json({ status: 'SUCCESS', state: systemState });
});

io.on('connection', (socket) => {
  socket.emit('display_update', systemState);

  socket.on('broadcast_display', (data) => {
    systemState = { ...systemState, ...data };
    io.emit('display_update', systemState);
  });

  socket.on('hardware_touch_event', (eventData) => {
    console.log('[ESP32 TOUCH EVENT]:', eventData);
    io.emit('hardware_log', eventData);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[ENTERPRISE HUB] Running on port ${PORT}`);
});
