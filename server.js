const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

let agentData = {
  agent: "SECRETARY",
  title: "Cloud Active",
  message: "Connected to Render Cloud API!"
};

app.get('/api/display', (req, res) => {
  res.json(agentData);
});

app.post('/api/update', (req, res) => {
  const { agent, title, message } = req.body;
  if (agent && title && message) {
    agentData = { agent, title, message };
    return res.json({ status: "success", data: agentData });
  }
  res.status(400).json({ status: "error", message: "Invalid payload" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
