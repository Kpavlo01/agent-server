const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Αρχική κατάσταση Agents
let currentAgent = {
  type: "SECRETARY",
  title: "Secretary AI",
  message: "Ready for tasks."
};

// Endpoints
app.get('/api/display', (req, res) => {
  res.json(currentAgent);
});

app.post('/api/agent/switch', (req, res) => {
  const { type, prompt } = req.body;
  
  if (type === "SECRETARY") {
    currentAgent = {
      type: "SECRETARY",
      title: "Γραμματέας",
      message: prompt || "Έλεγχος ραντεβού & emails..."
    };
  } else if (type === "REMINDER") {
    currentAgent = {
      type: "REMINDER",
      title: "Υπενθύμιση",
      message: prompt || "Μην ξεχάσεις το meeting!"
    };
  } else if (type === "SOCIAL") {
    currentAgent = {
      type: "SOCIAL",
      title: "Social Media",
      message: prompt || "Νέο post στο Instagram!"
    };
  }
  
  res.json({ status: "success", data: currentAgent });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
