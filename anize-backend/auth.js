(function (global) {
  const API_BASE = 'https://anize-backend.vercel.app';
  const TOKEN_KEY = 'anize_token';
  const USER_KEY  = 'anize_user';

  function saveSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  async function apiFetch(path, opts = {}) {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(API_BASE + path, { ...opts, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  const AniZeAuth = {
    getToken()   { return localStorage.getItem(TOKEN_KEY); },
    isLoggedIn() { return !!localStorage.getItem(TOKEN_KEY); },
    getUser()    { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } },

    async register(username, email, password) {
      const data = await apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password }) });
      saveSession(data.token, data.user);
      return data;
    },

    async login(email, password) {
      const data = await apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      saveSession(data.token, data.user);
      return data;
    },

    logout(redirectTo = 'anize-login.html') {
      clearSession();
      window.location.href = redirectTo;
    },

    async getWatchlist() {
      const data = await apiFetch('/api/user/watchlist');
      return data.watchlist;
    },

    async addToWatchlist(entry) {
      const data = await apiFetch('/api/user/watchlist', { method: 'POST', body: JSON.stringify(entry) });
      return data.entry;
    },

    async removeFromWatchlist(animeId) {
      await apiFetch(`/api/user/watchlist/${animeId}`, { method: 'DELETE' });
      return true;
    }
  };

  global.AniZeAuth = AniZeAuth;
})(window);