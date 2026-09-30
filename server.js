const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Global Multi-Module System State
let systemState = {
  currentModule: "CRYPTO_DESK", // CRYPTO_DESK, ECU_DIAG, WORKSHOP, SPOTIFY
  agent: "AUTONOMOUS_HUB",
  title: "SYSTEM OPERATIONAL",
  message: "All operational pipelines synchronized.",
  spotify: {
    isPlaying: false,
    track: "Not Playing",
    artist: "Spotify Offline",
    progressMs: 0,
    durationMs: 0
  },
  crypto: { btc: "88,450", xrp: "2.415", aero: "1.240" },
  ecu: { map: "STAGE 2 GT3", boost: "1.4 bar", oilTemp: "92C", dtc: "CLEAR" }
};

// --- SPOTIFY OAUTH & API INTEGRATION ---
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "YOUR_CLIENT_ID";
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "YOUR_CLIENT_SECRET";
let spotifyAccessToken = "";

app.get('/api/spotify/login', (req, res) => {
  const scope = 'user-read-currently-playing user-read-playback-state user-modify-playback-state';
  const redirect_uri = `${req.protocol}://${req.get('host')}/callback`;
  res.redirect(`https://accounts.spotify.com/authorize?response_type=code&client_id=${SPOTIFY_CLIENT_ID}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirect_uri)}`);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  const redirect_uri = `${req.protocol}://${req.get('host')}/callback`;
  try {
    const response = await axios.post('https://accounts.spotify.com/api/token', new URLSearchParams({
      grant_type: 'authorization_code', code: code, redirect_uri: redirect_uri
    }), {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    spotifyAccessToken = response.data.access_token;
    res.send('<h2>Spotify Successfully Connected! You can close this tab.</h2>');
  } catch (err) {
    res.status(500).send('Spotify Auth Error');
  }
});

async function updateSpotifyState() {
  if (!spotifyAccessToken) return;
  try {
    const res = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { 'Authorization': `Bearer ${spotifyAccessToken}` }
    });
    if (res.data && res.data.item) {
      systemState.spotify.isPlaying = res.data.is_playing;
      systemState.spotify.track = res.data.item.name;
      systemState.spotify.artist = res.data.item.artists.map(a => a.name).join(', ');
      systemState.spotify.progressMs = res.data.progress_ms;
      systemState.spotify.durationMs = res.data.item.duration_ms;
      io.emit('display_update', systemState);
    }
  } catch (e) {}
}
setInterval(updateSpotifyState, 3000);

// Unified Webhook Dispatch
app.post('/api/v1/dispatch', (req, res) => {
  const { module, agent, title, message } = req.body;
  if (module) systemState.currentModule = module;
  if (agent) systemState.agent = agent;
  if (title) systemState.title = title;
  if (message) systemState.message = message;

  io.emit('display_update', systemState);
  res.status(200).json({ status: 'OK', state: systemState });
});

io.on('connection', (socket) => {
  socket.emit('display_update', systemState);

  socket.on('broadcast_display', (data) => {
    systemState = { ...systemState, ...data };
    io.emit('display_update', systemState);
  });

  socket.on('spotify_control', async (action) => {
    if (!spotifyAccessToken) return;
    try {
      if (action === 'next') await axios.post('https://api.spotify.com/v1/me/player/next', {}, { headers: { 'Authorization': `Bearer ${spotifyAccessToken}` } });
      if (action === 'prev') await axios.post('https://api.spotify.com/v1/me/player/previous', {}, { headers: { 'Authorization': `Bearer ${spotifyAccessToken}` } });
      if (action === 'play') await axios.put('https://api.spotify.com/v1/me/player/play', {}, { headers: { 'Authorization': `Bearer ${spotifyAccessToken}` } });
      if (action === 'pause') await axios.put('https://api.spotify.com/v1/me/player/pause', {}, { headers: { 'Authorization': `Bearer ${spotifyAccessToken}` } });
      setTimeout(updateSpotifyState, 500);
    } catch(e) {}
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`[ULTIMATE HUB] Active on port ${PORT}`));
