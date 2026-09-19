const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// State Management
const devicesState = {
  'DEV_001': {
    agent: "SECRETARY",
    title: "EXECUTIVE HUB",
    message: "Systima etoimo gia leitourgia.",
    theme: { headerBg: "0x001F", textColor: "0xFFFF", accentColor: "0x07FF" },
    alertSound: false
  }
};

// Agents Configuration Database
const AGENT_CONFIGS = {
  SECRETARY: {
    title: "GRAMMATEAS",
    headerBg: "0x001F",
    textColor: "0xFFFF",
    accentColor: "0x07FF",
    prompt: "Είσαι AI Γραμματέας. Δώσε σύντομη περίληψη ή εντολή (έως 12 λέξεις)."
  },
  REMINDER: {
    title: "YPENThYMISI",
    headerBg: "0xFD20",
    textColor: "0xFFFF",
    accentColor: "0xFFE0",
    prompt: "Είσαι AI Reminder Bot. Δώσε μια πολύ καθαρή υπενθύμιση (έως 10 λέξεις)."
  },
  CRYPTO: {
    title: "MARKET TRACKER",
    headerBg: "0x03E0",
    textColor: "0xFFFF",
    accentColor: "0x07E0",
    prompt: "Είσαι Crypto Analyst. Δώσε σύντομο update τιμών ή τάσης (έως 10 λέξεις)."
  },
  ECU_DIAG: {
    title: "ECU DIAGNOSTIC",
    headerBg: "0x7800",
    textColor: "0xFFFF",
    accentColor: "0xFDA0",
    prompt: "Είσαι Automotive Diagnostic Specialist σε ECU programming, επισκευές πλακετών και μπαταριές. Δώσε σύντομη διάγνωση/alert (έως 10 λέξεις)."
  },
  CALENDAR: {
    title: "CALENDAR SYNC",
    headerBg: "0x0015",
    textColor: "0xFFFF",
    accentColor: "0x3A8F",
    prompt: "Είσαι Google Calendar Assistant. Πρόβαλε το επόμενο σημαντικό ραντεβού (έως 10 λέξεις)."
  }
};

let currentAgentIndex = 0;
const agentKeys = Object.keys(AGENT_CONFIGS);

io.on('connection', (socket) => {
  console.log('⚡ Client connected:', socket.id);
  socket.emit('display_update', devicesState['DEV_001']);

  // Physical Button Event από το ESP32
  socket.on('button_click', (data) => {
    if (data.action === 'NEXT') {
      currentAgentIndex = (currentAgentIndex + 1) % agentKeys.length;
    } else if (data.action === 'PREV') {
      currentAgentIndex = (currentAgentIndex - 1 + agentKeys.length) % agentKeys.length;
    }
    const selectedAgent = agentKeys[currentAgentIndex];
    const config = AGENT_CONFIGS[selectedAgent];

    const newState = {
      agent: selectedAgent,
      title: config.title,
      message: `Active: ${config.title}`,
      theme: { headerBg: config.headerBg, textColor: config.textColor, accentColor: config.accentColor },
      alertSound: false
    };

    devicesState['DEV_001'] = newState;
    io.emit('display_update', newState);
  });
});

app.get('/api/display', (req, res) => {
  const token = req.query.token || 'DEV_001';
  res.json(devicesState[token] || devicesState['DEV_001']);
});

// Live Crypto Feed & Stop-Loss/Take-Profit Alert Engine
app.post('/api/crypto/alert-check', async (req, res) => {
  try {
    const { coin = 'bitcoin', tp, sl } = req.body;
    const symbol = coin.toLowerCase();
    const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd&include_24hr_change=true`);
    const data = await response.json();

    if (data[symbol]) {
      const price = data[symbol].usd;
      const change = data[symbol].usd_24h_change ? data[symbol].usd_24h_change.toFixed(2) : '0';
      let alertState = "NORMAL";
      let headerColor = change >= 0 ? "0x03E0" : "0xF800";

      if (tp && price >= parseFloat(tp)) {
        alertState = "TAKE PROFIT HIT 🎯";
        headerColor = "0x07E0"; // Bright Green
      } else if (sl && price <= parseFloat(sl)) {
        alertState = "STOP LOSS HIT ⚠️";
        headerColor = "0xF800"; // Red
      }

      const msg = `${symbol.toUpperCase()}: $${price} (${change}%)\n${alertState !== 'NORMAL' ? alertState : 'Trading Active'}`;

      const newState = {
        agent: "CRYPTO",
        title: alertState !== 'NORMAL' ? "CRITICAL ALERT" : "MARKET LIVE",
        message: msg,
        theme: { headerBg: headerColor, textColor: "0xFFFF", accentColor: headerColor },
        alertSound: alertState !== 'NORMAL'
      };

      devicesState['DEV_001'] = newState;
      io.emit('display_update', newState);
      return res.json({ status: "success", data: newState });
    }
    res.status(400).json({ error: "Coin not found" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dispatcher για AI Agents
app.post('/api/agent/switch', async (req, res) => {
  const { type, prompt, token = 'DEV_001' } = req.body;
  const config = AGENT_CONFIGS[type] || AGENT_CONFIGS.SECRETARY;

  let finalMessage = prompt || "No message provided";

  if (process.env.GEMINI_API_KEY && prompt) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          systemInstruction: config.prompt,
          maxOutputTokens: 50,
        }
      });
      if (response && response.text) {
        finalMessage = response.text.trim();
      }
    } catch (err) {
      console.error("AI Error:", err.message);
    }
  }

  const newState = {
    agent: type,
    title: config.title,
    message: finalMessage,
    theme: { headerBg: config.headerBg, textColor: config.textColor, accentColor: config.accentColor },
    alertSound: false
  };

  devicesState[token] = newState;
  io.emit('display_update', newState);

  res.json({ status: "success", agent: type, message: finalMessage });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Multi-Agent Command Hub Active on Port ${PORT}`));
