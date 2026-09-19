const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Αρχική κατάσταση Agents (με τα σωστά πεδία για το ESP32)
let currentAgent = {
  agent: "SECRETARY",
  title: "Secretary AI",
  message: "Ready for tasks."
};

// Endpoint για το ESP32
app.get('/api/display', (req, res) => {
  res.json(currentAgent);
});

// Endpoint για το Web Panel
app.post('/api/agent/switch', (req, res) => {
  const { type, prompt } = req.body;
  
  if (type === "SECRETARY") {
    currentAgent = {
      agent: "SECRETARY",
      title: "Γραμματέας",
      message: prompt || "Έλεγχος ραντεβού..."
    };
  } else if (type === "REMINDER") {
    currentAgent = {
      agent: "REMINDER",
      title: "Υπενθύμιση",
      message: prompt || "Μην ξεχάσεις το task!"
    };
  } else if (type === "SOCIAL") {
    currentAgent = {
      agent: "SOCIAL",
      title: "Social Media",
      message: prompt || "Νέο post στο Insta!"
    };
  }
  
  res.json({ status: "success", data: currentAgent });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
