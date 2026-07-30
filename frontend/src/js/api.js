// frontend/src/js/api.js
const API_BASE = window.location.origin;

// Claves de la sesion en localStorage. Siempre se limpian TODAS juntas: dejar
// un access_token vencido sin su refresh era justo lo que provocaba el
// ping-pong login <-> dashboard (el dashboard veia "hay token" y entraba, el
// backend respondia 401 y lo mandaba al login, el login veia "hay token" y lo
// mandaba al dashboard... en bucle, de ahi el parpadeo).
const SESSION_KEYS = ['access_token', 'refresh_token', 'user'];

function clearSession() {
  SESSION_KEYS.forEach((k) => localStorage.removeItem(k));
}

// Un solo redirect por carga de pagina: varias peticiones pueden recibir 401 a
// la vez (header, contadores, lista de devices) y cada una intentaba navegar.
let _redirectingToLogin = false;
function goToLogin() {
  if (_redirectingToLogin) return;
  _redirectingToLogin = true;
  clearSession();
  // replace() en vez de href: no deja la pagina protegida en el historial, asi
  // el boton "atras" no vuelve a disparar otra vuelta del rebote.
  window.location.replace('/index.html');
}

const API = {
  _accessToken: () => localStorage.getItem('access_token'),
  _refreshToken: () => localStorage.getItem('refresh_token'),
  _refreshing: null,

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
        goToLogin();
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
      // El refresh sirvio pero el token nuevo tampoco pasa: la sesion murio.
      if (res.status === 401) {
        goToLogin();
        return null;
      }
    }

    if (!res.ok) {
      const err = new Error(`API ${res.status}`);
      err.status = res.status;
      try { err.body = await res.json(); } catch (_) {}
      throw err;
    }
    return res.json();
  },

  async _refresh() {
    // Si varias peticiones fallan a la vez, un solo POST /auth/refresh para
    // todas (antes se disparaban en paralelo y se pisaban entre si).
    if (this._refreshing) return this._refreshing;
    this._refreshing = (async () => {
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
        if (!data || !data.access_token) return false;
        localStorage.setItem('access_token', data.access_token);
        return true;
      } catch {
        return false;
      }
    })();
    try {
      return await this._refreshing;
    } finally {
      this._refreshing = null;
    }
  },

  get(path) { return this._request('GET', path); },
  post(path, body) { return this._request('POST', path, body); },
  put(path, body) { return this._request('PUT', path, body); },
  delete(path) { return this._request('DELETE', path); },
};

// Auth guard for protected pages. Devuelve false si no hay sesion (la pagina
// ya esta navegando al login y no deberia seguir inicializandose).
function requireAuth() {
  if (!localStorage.getItem('access_token')) {
    goToLogin();
    return false;
  }
  return true;
}
