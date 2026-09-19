const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Προκαθορισμένα UI Themes για κάθε Agent
const AGENT_CONFIGS = {
  SECRETARY: {
    title: "ΓΡΑΜΜΑΤΕΑΣ",
    bgColor: "0x0000",       // Black
    headerBg: "0x001F",      // Dark Blue
    textColor: "0xFFFF",     // White
    accentColor: "0x07FF",    // Cyan
    prompt: "Είσαι επαγγελματίας AI Γραμματέας. Δώσε σύντομη περίληψη/εντολή για την οθόνη (έως 12 λέξεις)."
  },
  REMINDER: {
    title: "ΥΠΕΝΘΥΜΙΣΗ",
    bgColor: "0x0000",       // Black
    headerBg: "0xFD20",      // Orange
    textColor: "0xFFFF",     // White
    accentColor: "0xFFE0",    // Yellow
    prompt: "Είσαι AI Reminder Bot. Δώσε μια πολύ καθαρή υπενθύμιση/task (έως 10 λέξεις)."
  },
  SOCIAL: {
    title: "SOCIAL MEDIA",
    bgColor: "0x0000",       // Black
    headerBg: "0xF81F",      // Pink/Magenta
    textColor: "0xFFFF",     // White
    accentColor: "0xF81F",    // Magenta
    prompt: "Είσαι Social Media Manager Agent. Δημιούργησε ένα catchy headline/caption (έως 10 λέξεις)."
  }
};

let currentAgentState = {
  agent: "SECRETARY",
  title: AGENT_CONFIGS.SECRETARY.title,
  message: "Ετοιμο για εργασιες.",
  theme: {
    headerBg: AGENT_CONFIGS.SECRETARY.headerBg,
    textColor: AGENT_CONFIGS.SECRETARY.textColor,
    accentColor: AGENT_CONFIGS.SECRETARY.accentColor
  }
};

app.get('/api/display', (req, res) => {
  res.json(currentAgentState);
});

app.post('/api/agent/switch', async (req, res) => {
  const { type, prompt } = req.body;
  const config = AGENT_CONFIGS[type] || AGENT_CONFIGS.SECRETARY;

  let aiMessage = prompt;

  if (process.env.GEMINI_API_KEY && prompt) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction: config.prompt,
          maxOutputTokens: 50,
        }
      });
      aiMessage = response.text.trim();
    } catch (err) {
      console.error("AI Error:", err);
    }
  }

  currentAgentState = {
    agent: type,
    title: config.title,
    message: aiMessage || "Καμία νέα ειδοποίηση.",
    theme: {
      headerBg: config.headerBg,
      textColor: config.textColor,
      accentColor: config.accentColor
    }
  };

  res.json({ status: "success", data: currentAgentState });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
