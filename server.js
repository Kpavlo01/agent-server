const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Αρχικοποίηση AI Client (χρειάζεται GEMINI_API_KEY στο Render)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

let currentAgent = {
  agent: "SECRETARY",
  title: "AI Brain Ready",
  message: "Awaiting input..."
};

// System Prompts ανά Agent
const AGENT_PROMPTS = {
  SECRETARY: "Είσαι ένας αυστηρός, επαγγελματίας AI Γραμματέας. Ανάλυσε το αίτημα του χρήστη και δώσε μια σύντομη, περιεκτική περίληψη για την οθόνη (μέχρι 15 λέξεις).",
  REMINDER: "Είσαι ένα AI Reminder Bot. Μετάτρεψε το αίτημα του χρήστη σε μια καθαρή, άμεση υπενθύμιση με checklist ή ώρα (μέχρι 12 λέξεις).",
  SOCIAL: "Είσαι ένας Social Media Manager Agent. Δημιούργησε ένα δυνατό, catchy headline/caption με βάση το αίτημα (μέχρι 12 λέξεις)."
};

app.get('/api/display', (req, res) => {
  res.json(currentAgent);
});

app.post('/api/agent/switch', async (req, res) => {
  const { type, prompt } = req.body;
  const agentType = type || "SECRETARY";

  try {
    let aiMessage = prompt;

    // Αν υπάρχει API Key, επεξεργαζόμαστε την εντολή μέσω AI
    if (process.env.GEMINI_API_KEY && prompt) {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction: AGENT_PROMPTS[agentType] || AGENT_PROMPTS.SECRETARY,
          maxOutputTokens: 60,
        }
      });
      aiMessage = response.text.trim();
    }

    currentAgent = {
      agent: agentType,
      title: agentType === "SECRETARY" ? "Γραμματέας AI" : agentType === "REMINDER" ? "Υπενθύμιση AI" : "Social Media AI",
      message: aiMessage || "Δεν δόθηκε εντολή."
    };

    res.json({ status: "success", data: currentAgent });
  } catch (error) {
    console.error("AI Generation Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
