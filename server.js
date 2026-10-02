const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const querystring = require('querystring');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));
app.use(express.json());

// Spotify Credentials (από το Spotify Developer Dashboard)
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || 'YOUR_SPOTIFY_CLIENT_ID';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || 'YOUR_SPOTIFY_CLIENT_SECRET';
const REDIRECT_URI = process.env.REDIRECT_URI || 'https://agent-server-0x1z.onrender.com/api/spotify/callback';

let spotifyAccessToken = null;
let spotifyRefreshToken = null;

// Global System State
let systemState = {
  currentModule: "CRYPTO_DESK",
  agent: "COMMAND_HUB",
  title: "SYSTEM OPERATIONAL",
  message: "All operational pipelines synchronized with ESP32 node.",
  crypto: { btc: "89,450", xrp: "2.45" },
  spotify: {
    authenticated: false,
    track: "Not Playing",
    artist: "Offline",
    albumArt: "",
    progressMs: 0,
    durationMs: 0,
    isPlaying: false
  }
};

// 🎵 1. Spotify Login Redirect
app.get('/api/spotify/login', (req, res) => {
  const scope = 'user-read-currently-playing user-read-playback-state user-modify-playback-state';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: SPOTIFY_CLIENT_ID,
      scope: scope,
      redirect_uri: REDIRECT_URI
    }));
});

// 🎵 2. Spotify OAuth Callback
app.get('/api/spotify/callback', async (req, res) => {
  const code = req.query.code || null;
  try {
    const response = await axios.post('https://accounts.spotify.com/api/token', 
      querystring.stringify({
        code: code,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + (Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64'))
        }
      });

    spotifyAccessToken = response.data.access_token;
    spotifyRefreshToken = response.data.refresh_token;
    systemState.spotify.authenticated = true;

    res.redirect('/?spotify=connected');
  } catch (err) {
    console.error('Spotify Auth Error:', err.response ? err.response.data : err.message);
    res.redirect('/?error=spotify_auth_failed');
  }
});

// Poll Spotify Currently Playing Track
async function updateSpotifyPlayback() {
  if (!spotifyAccessToken) return;

  try {
    const res = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { 'Authorization': `Bearer ${spotifyAccessToken}` }
    });

    if (res.data && res.data.item) {
      systemState.spotify.track = res.data.item.name;
      systemState.spotify.artist = res.data.item.artists.map(a => a.name).join(', ');
      systemState.spotify.albumArt = res.data.item.album.images[0]?.url || "";
      systemState.spotify.progressMs = res.data.progress_ms;
      systemState.spotify.durationMs = res.data.item.duration_ms;
      systemState.spotify.isPlaying = res.data.is_playing;
      systemState.spotify.authenticated = true;
    } else {
      systemState.spotify.isPlaying = false;
    }
  } catch (err) {
    if (err.response && err.response.status === 401 && spotifyRefreshToken) {
      // Refresh Token Engine
      refreshSpotifyToken();
    }
  }
}

async function refreshSpotifyToken() {
  try {
    const res = await axios.post('https://accounts.spotify.com/api/token',
      querystring.stringify({
        grant_type: 'refresh_token',
        refresh_token: spotifyRefreshToken
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + (Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64'))
        }
      });
    spotifyAccessToken = res.data.access_token;
  } catch (e) {
    console.error("Failed to refresh Spotify token");
  }
}

// Polling interval
setInterval(() => {
  updateSpotifyPlayback();
  io.emit('display_update', systemState);
}, 2000);

// WebSocket Connections
io.on('connection', (socket) => {
  socket.emit('display_update', systemState);

  socket.on('broadcast_display', (data) => {
    Object.assign(systemState, data);
    io.emit('display_update', systemState);
  });

  socket.on('spotify_control', async (action) => {
    if (!spotifyAccessToken) return;
    try {
      const endpoint = `https://api.spotify.com/v1/me/player/${action}`;
      const method = (action === 'play' || action === 'pause') ? 'put' : 'post';
      await axios({ method, url: endpoint, headers: { 'Authorization': `Bearer ${spotifyAccessToken}` } });
      setTimeout(updateSpotifyPlayback, 500);
    } catch (err) {
      console.error(`Spotify Control (${action}) Error:`, err.message);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
