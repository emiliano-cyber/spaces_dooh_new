// frontend/src/js/api.js
const API_BASE = window.location.origin;

const API = {
  _accessToken: () => localStorage.getItem('access_token'),
  _refreshToken: () => localStorage.getItem('refresh_token'),

  async _request(method, path, body) {
    let token = this._accessToken();
    let res = await fetch(API_BASE + path, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
      const refreshed = await this._refresh();
      if (!refreshed) {
        window.location.href = '/index.html';
        return null;
      }
      res = await fetch(API_BASE + path, {
        method,
        headers: {
          'Authorization': `Bearer ${this._accessToken()}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    }

    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  },

  async _refresh() {
    const rt = this._refreshToken();
    if (!rt) return false;
    try {
      const res = await fetch(API_BASE + '/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      localStorage.setItem('access_token', data.access_token);
      return true;
    } catch {
      return false;
    }
  },

  get(path) { return this._request('GET', path); },
  post(path, body) { return this._request('POST', path, body); },
  put(path, body) { return this._request('PUT', path, body); },
  delete(path) { return this._request('DELETE', path); },
};

// Auth guard for protected pages
function requireAuth() {
  if (!localStorage.getItem('access_token')) {
    window.location.href = '/index.html';
  }
}
