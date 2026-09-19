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
const io = new Server(server, {
  cors: { origin: "*" }
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const devicesState = {
  'DEV_001': {
    agent: "SECRETARY",
    title: "GRAMMATEAS",
    message: "Etoimo gia ergaxies.",
    theme: { headerBg: "0x001F", textColor: "0xFFFF", accentColor: "0x07FF" }
  }
};

const AGENT_CONFIGS = {
  SECRETARY: {
    title: "GRAMMATEAS",
    headerBg: "0x001F",
    textColor: "0xFFFF",
    accentColor: "0x07FF",
    prompt: "Είσαι AI Γραμματέας. Δώσε σύντομη περίληψη/εντολή για την οθόνη (έως 12 λέξεις)."
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
  }
};

// WebSockets Connection logic
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Στέλνουμε την τρέχουσα κατάσταση αμέσως μόλις συνδεθεί η συσκευή
  socket.emit('display_update', devicesState['DEV_001']);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

app.get('/api/display', (req, res) => {
  const token = req.query.token || 'DEV_001';
  res.json(devicesState[token] || devicesState['DEV_001']);
});

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
    theme: {
      headerBg: config.headerBg,
      textColor: config.textColor,
      accentColor: config.accentColor
    }
  };

  devicesState[token] = newState;

  // PUSH ΑΚΑΡΙΑΙΑ ΣΕ ΟΛΟΥΣ ΤΟΥΣ CLIENTS (WebSockets)
  io.emit('display_update', newState);

  res.json({ status: "success", agent: type, message: finalMessage });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Real-Time Socket Server running on port ${PORT}`));
