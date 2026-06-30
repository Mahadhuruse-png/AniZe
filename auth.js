(function (global) {
  const API_BASE = 'https://anize-backend-ijcn.vercel.app';
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
    },

    async updateProfile(username, email) {
      const data = await apiFetch('/api/auth/update', { method: 'PUT', body: JSON.stringify({ username, email }) });
      const token = localStorage.getItem(TOKEN_KEY);
      saveSession(token, data.user);
      return data.user;
    },

    async changePassword(currentPassword, newPassword) {
      const data = await apiFetch('/api/auth/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) });
      return data;
    },

    async forgotPassword(email) {
      const data = await apiFetch('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
      return data;
    },

    async resetPassword(token, newPassword) {
      const data = await apiFetch('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) });
      return data;
    }
  };

  global.AniZeAuth = AniZeAuth;
})(window);
