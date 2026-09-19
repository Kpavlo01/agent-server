const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

let db;
(async () => {
  db = await open({
    filename: './database.db',
    driver: sqlite3.Database
  });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS device_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_token TEXT UNIQUE,
      agent TEXT,
      title TEXT,
      message TEXT,
      theme_headerBg TEXT,
      theme_textColor TEXT,
      theme_accentColor TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Αρχικοποίηση default συσκευής
  await db.run(`
    INSERT OR IGNORE INTO device_state (device_token, agent, title, message, theme_headerBg, theme_textColor, theme_accentColor)
    VALUES ('DEV_001', 'SECRETARY', 'GRAMMATEAS', 'Etoimo gia ergaxies.', '0x001F', '0xFFFF', '0x07FF')
  `);
})();

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
    prompt: "Είσαι Social Media Manager Agent. Δημιούργησε ένα catchy headline (έως 10 λέξεις)."
  },
  CRYPTO: {
    title: "MARKET TRACKER",
    headerBg: "0x03E0",      // Green
    textColor: "0xFFFF",
    accentColor: "0x07E0",
    prompt: "Είσαι Market Analyst Agent. Δώσε σύντομη ανάλυση ή update τιμών (έως 10 λέξεις)."
  }
};

// Endpoint για το ESP32
app.get('/api/display', async (req, res) => {
  const token = req.query.token || 'DEV_001';
  const row = await db.get('SELECT * FROM device_state WHERE device_token = ?', [token]);
  
  if (!row) {
    return res.status(404).json({ error: "Device not found" });
  }

  res.json({
    agent: row.agent,
    title: row.title,
    message: row.message,
    theme: {
      headerBg: row.theme_headerBg,
      textColor: row.theme_textColor,
      accentColor: row.theme_accentColor
    }
  });
});

// Endpoint για το Web Dashboard
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

  await db.run(`
    UPDATE device_state SET 
      agent = ?, title = ?, message = ?, 
      theme_headerBg = ?, theme_textColor = ?, theme_accentColor = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE device_token = ?
  `, [type, config.title, finalMessage, config.headerBg, config.textColor, config.accentColor, token]);

  res.json({ status: "success", agent: type, message: finalMessage });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
