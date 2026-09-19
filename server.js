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
    theme: { headerBg: "0x001F", textColor: "0xFFFF", accentColor: "0x07FF" }
  }
};

// Dynamic Agents Storage
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
  SOCIAL: {
    title: "SOCIAL MEDIA",
    headerBg: "0xF81F",
    textColor: "0xFFFF",
    accentColor: "0xF81F",
    prompt: "Είσαι Social Media Manager. Δημιούργησε ένα catchy headline (έως 10 λέξεις)."
  },
  CRYPTO: {
    title: "MARKET TRACKER",
    headerBg: "0x03E0",
    textColor: "0xFFFF",
    accentColor: "0x07E0",
    prompt: "Είσαι Crypto/Market Analyst. Δώσε σύντομο update τιμών ή τάσης (έως 10 λέξεις)."
  },
  DIAGNOSTIC: {
    title: "ECU DIAGNOSTIC",
    headerBg: "0x7800",
    textColor: "0xFFFF",
    accentColor: "0xFDA0",
    prompt: "Είσαι Automotive Diagnostic Specialist. Δώσε σύντομη διάγνωση/alert (έως 10 λέξεις)."
  }
};

io.on('connection', (socket) => {
  console.log('⚡ Client connected:', socket.id);
  socket.emit('display_update', devicesState['DEV_001']);
});

// REST API για ESP32 Fallback
app.get('/api/display', (req, res) => {
  const token = req.query.token || 'DEV_001';
  res.json(devicesState[token] || devicesState['DEV_001']);
});

// Live Crypto Feed (CoinGecko API με Support για BTC, XRP, AERO, GRAM)
app.get('/api/crypto/live', async (req, res) => {
  try {
    const symbol = (req.query.coin || 'bitcoin').toLowerCase();
    const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd&include_24hr_change=true`);
    const data = await response.json();
    
    if (data[symbol]) {
      const price = data[symbol].usd;
      const change = data[symbol].usd_24h_change ? data[symbol].usd_24h_change.toFixed(2) : '0';
      const trend = change >= 0 ? "▲" : "▼";
      
      const msg = `${symbol.toUpperCase()}: $${price.toLocaleString()} (${trend} ${change}%)`;
      
      const newState = {
        agent: "CRYPTO",
        title: "MARKET LIVE",
        message: msg,
        theme: {
          headerBg: change >= 0 ? "0x03E0" : "0xF800",
          textColor: "0xFFFF",
          accentColor: change >= 0 ? "0x07E0" : "0xF800"
        }
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

// Dynamic Custom Agent Creator Endpoint
app.post('/api/agent/create', (req, res) => {
  const { id, title, prompt, headerBg, accentColor } = req.body;
  if (!id || !title) return res.status(400).json({ error: "Missing required fields" });

  const agentKey = id.toUpperCase();
  AGENT_CONFIGS[agentKey] = {
    title: title.toUpperCase(),
    headerBg: headerBg || "0x001F",
    textColor: "0xFFFF",
    accentColor: accentColor || "0x07FF",
    prompt: prompt || "Δώσε σύντομο μήνυμα."
  };

  res.json({ status: "success", agent: AGENT_CONFIGS[agentKey] });
});

// AI Agent Dispatcher
app.post('/api/agent/switch', async (req, res) => {
  const { type, prompt, token = 'DEV_001' } = req.body;
  const config = AGENT_CONFIGS[type] || AGENT_CONFIGS.SECRETARY;

  let finalMessage = prompt || "Den dothike minima.";

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
      console.error("AI Generation Error:", err.message);
    }
  }

  const newState = {
    agent: type,
    title: config.title,
    message: finalMessage,
    theme: {
      headerBg: config.headerBg,
      textColor: config.textColor,
      accentColor: config.accentColor
    }
  };

  devicesState[token] = newState;
  io.emit('display_update', newState);

  res.json({ status: "success", agent: type, message: finalMessage });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Production Server Active on Port ${PORT}`));
