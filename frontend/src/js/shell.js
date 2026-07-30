// frontend/src/js/shell.js
// Encabezado unificado para TODAS las paginas (vanilla JS, sin Alpine, para evitar
// conflictos de timing). Inyecta el header en <div id="app-header"></div>:
//   - Logo + navegacion (Devices, Galeria, Graficas, Programacion, Campanas, Verificacion)
//   - Contador "N online · M total"
//   - Menu de usuario (avatar) con: Mi perfil, Cambiar contrasena, Crear usuario (admin), Cerrar sesion
//   - Responsive: menu hamburguesa en pantallas chicas
// Requiere que api.js este cargado antes (usa el objeto global API).
(function () {
  const NAV = [
    { key: 'devices', label: 'Devices', href: '/dashboard.html' },
    { key: 'galeria', label: 'Galería', href: '/gallery.html' },
    { key: 'graficas', label: 'Gráficas', href: '/graficas.html' },
    { key: 'ajustar-texto', label: 'Ajustar texto', href: '/ajustar-texto.html' },
    { key: 'programacion', label: 'Programación', href: '/scheduler.html' },
    { key: 'campanas', label: 'Campañas', href: '/campaigns.html' },
    { key: 'verificacion', label: 'Verificación', href: '/verification.html' },
  ];

  function activeKey() {
    const p = location.pathname;
    if (p.includes('gallery')) return 'galeria';
    if (p.includes('graficas')) return 'graficas';
    if (p.includes('ajustar-texto')) return 'ajustar-texto';
    if (p.includes('scheduler')) return 'programacion';
    if (p.includes('campaigns')) return 'campanas';
    if (p.includes('verification')) return 'verificacion';
    return 'devices'; // dashboard y device-detail
  }

  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function navLinks(active, mobile) {
    return NAV.map((n) => {
      const on = n.key === active;
      const cls = mobile
        ? `block px-4 py-2.5 text-sm ${on ? 'text-blue-600 font-medium bg-blue-50' : 'text-neutral-600 hover:bg-neutral-50'}`
        : `${on ? 'text-blue-600 font-medium' : 'text-neutral-500 hover:text-neutral-900'}`;
      return `<a href="${n.href}" class="${cls}">${n.label}</a>`;
    }).join('');
  }

  function render() {
    const mount = document.getElementById('app-header');
    if (!mount) return;
    const active = activeKey();

    mount.innerHTML = `
    <header class="bg-white border-b border-neutral-200 sticky top-0 z-30">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <!-- Logo -->
        <a href="/dashboard.html" class="flex items-center gap-2 shrink-0">
          <div class="w-8 h-8 bg-[#0A66FF] rounded flex items-center justify-center text-white font-bold">E</div>
          <h1 class="text-base sm:text-lg font-medium whitespace-nowrap">SPACE EYE</h1>
        </a>
        <!-- Nav desktop -->
        <nav class="hidden lg:flex items-center gap-5 text-sm">${navLinks(active, false)}</nav>
        <!-- Derecha -->
        <div class="flex items-center gap-3 sm:gap-4">
          <span class="hidden sm:inline text-xs sm:text-sm text-neutral-500 whitespace-nowrap">
            <span id="hdr-online" class="font-medium text-green-600">–</span> online ·
            <span id="hdr-total" class="font-medium">–</span> total
          </span>
          <!-- Usuario -->
          <div class="relative">
            <button id="hdr-user-btn" class="flex items-center gap-2 rounded-full hover:bg-neutral-100 pl-1 pr-2 py-1">
              <span id="hdr-avatar" class="w-8 h-8 rounded-full bg-neutral-800 text-white text-sm font-medium flex items-center justify-center">?</span>
              <span id="hdr-username" class="hidden sm:inline text-sm text-neutral-700 max-w-[120px] truncate">…</span>
              <svg class="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
            </button>
            <div id="hdr-user-menu" class="hidden absolute right-0 mt-2 w-56 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 z-40">
              <div class="px-4 py-2 border-b border-neutral-100">
                <div id="hdr-menu-name" class="text-sm font-medium text-neutral-900 truncate">…</div>
                <div id="hdr-menu-role" class="text-xs text-neutral-500"></div>
              </div>
              <button data-act="perfil" class="w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">Mi perfil</button>
              <button data-act="password" class="w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">Cambiar contraseña</button>
              <button data-act="crear" id="hdr-crear" class="hidden w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">Crear usuario</button>
              <div class="border-t border-neutral-100 my-1"></div>
              <button data-act="logout" class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Cerrar sesión</button>
            </div>
          </div>
          <!-- Hamburguesa (movil) -->
          <button id="hdr-burger" class="lg:hidden p-1.5 rounded hover:bg-neutral-100">
            <svg class="w-6 h-6 text-neutral-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
        </div>
      </div>
      <!-- Nav movil -->
      <nav id="hdr-mobile-nav" class="hidden lg:hidden border-t border-neutral-100 bg-white">
        ${navLinks(active, true)}
        <div class="px-4 py-2 text-xs text-neutral-500 border-t border-neutral-100 mt-1">
          <span id="hdr-online-m" class="font-medium text-green-600">–</span> online · <span id="hdr-total-m" class="font-medium">–</span> total
        </div>
      </nav>
    </header>

    <!-- Modales -->
    <div id="hdr-modal" class="hidden fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div class="flex items-center justify-between px-5 py-3 border-b border-neutral-200">
          <h3 id="hdr-modal-title" class="font-medium"></h3>
          <button id="hdr-modal-close" class="text-neutral-400 hover:text-neutral-700 text-2xl leading-none">&times;</button>
        </div>
        <div id="hdr-modal-body" class="p-5"></div>
      </div>
    </div>
    <div id="hdr-toast" class="hidden fixed bottom-5 right-5 z-[60] px-4 py-2.5 rounded-lg text-sm text-white shadow-lg"></div>
    `;

    wire();
    loadUser();
    loadCounts();
    setInterval(loadCounts, 30000);
  }

  function toast(msg, type = 'info') {
    const t = document.getElementById('hdr-toast');
    if (!t) return;
    t.textContent = msg;
    t.className = `fixed bottom-5 right-5 z-[60] px-4 py-2.5 rounded-lg text-sm text-white shadow-lg ${type === 'error' ? 'bg-red-600' : type === 'success' ? 'bg-green-600' : 'bg-neutral-800'}`;
    t.classList.remove('hidden');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.add('hidden'), 3200);
  }

  function openModal(title, bodyHtml) {
    document.getElementById('hdr-modal-title').textContent = title;
    document.getElementById('hdr-modal-body').innerHTML = bodyHtml;
    document.getElementById('hdr-modal').classList.remove('hidden');
  }
  function closeModal() { document.getElementById('hdr-modal').classList.add('hidden'); }

  let currentUser = null;

  function wire() {
    const userBtn = document.getElementById('hdr-user-btn');
    const userMenu = document.getElementById('hdr-user-menu');
    userBtn.addEventListener('click', (e) => { e.stopPropagation(); userMenu.classList.toggle('hidden'); });
    document.addEventListener('click', () => userMenu.classList.add('hidden'));
    userMenu.addEventListener('click', (e) => e.stopPropagation());

    document.getElementById('hdr-burger').addEventListener('click', () => {
      document.getElementById('hdr-mobile-nav').classList.toggle('hidden');
    });

    userMenu.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
      userMenu.classList.add('hidden');
      const act = b.getAttribute('data-act');
      if (act === 'logout') return doLogout();
      if (act === 'perfil') return showPerfil();
      if (act === 'password') return showChangePassword();
      if (act === 'crear') return showCreateUser();
    }));

    // El modal solo se cierra con el boton X o Cancelar (NO al hacer click fuera
    // ni al escribir), para no perder lo que el usuario esta capturando.
    document.getElementById('hdr-modal-close').addEventListener('click', closeModal);
  }

  async function loadUser() {
    try {
      const u = await API.get('/api/auth/me');
      currentUser = u;
      const initials = (u.full_name || u.email || '?').trim().charAt(0).toUpperCase();
      document.getElementById('hdr-avatar').textContent = initials;
      document.getElementById('hdr-username').textContent = u.full_name || u.email;
      document.getElementById('hdr-menu-name').textContent = u.full_name || u.email;
      document.getElementById('hdr-menu-role').textContent = ({ admin: 'Administrador', operator: 'Operador', viewer: 'Visor' }[u.role] || u.role);
      if (u.role === 'admin') document.getElementById('hdr-crear').classList.remove('hidden');
    } catch (e) { /* la pagina maneja la sesion */ }
  }

  async function loadCounts() {
    try {
      const data = await API.get('/api/devices');
      const list = data.devices || [];
      const online = list.filter((d) => d.online).length;
      ['hdr-online', 'hdr-online-m'].forEach((id) => { const n = document.getElementById(id); if (n) n.textContent = online; });
      ['hdr-total', 'hdr-total-m'].forEach((id) => { const n = document.getElementById(id); if (n) n.textContent = list.length; });
    } catch (e) { /* silencioso */ }
  }

  function showPerfil() {
    const u = currentUser || {};
    openModal('Mi perfil', `
      <div class="space-y-3 text-sm">
        <div><div class="text-neutral-500 text-xs">Nombre</div><div class="font-medium">${esc(u.full_name)}</div></div>
        <div><div class="text-neutral-500 text-xs">Correo</div><div class="font-medium">${esc(u.email)}</div></div>
        <div><div class="text-neutral-500 text-xs">Rol</div><div class="font-medium">${esc({ admin: 'Administrador', operator: 'Operador', viewer: 'Visor' }[u.role] || u.role)}</div></div>
      </div>
      <div class="mt-5 text-right"><button id="hdr-perfil-ok" class="px-4 py-2 text-sm bg-neutral-100 rounded hover:bg-neutral-200">Cerrar</button></div>
    `);
    document.getElementById('hdr-perfil-ok').addEventListener('click', closeModal);
  }

  function showChangePassword() {
    openModal('Cambiar contraseña', `
      <form id="hdr-pw-form" class="space-y-3 text-sm">
        <label class="block"><span class="text-neutral-500 text-xs">Contraseña actual</span>
          <input name="current" type="password" required class="mt-1 w-full px-3 py-2 border border-neutral-300 rounded"></label>
        <label class="block"><span class="text-neutral-500 text-xs">Nueva contraseña (mín. 8)</span>
          <input name="nueva" type="password" required minlength="8" class="mt-1 w-full px-3 py-2 border border-neutral-300 rounded"></label>
        <label class="block"><span class="text-neutral-500 text-xs">Confirmar nueva contraseña</span>
          <input name="confirmar" type="password" required minlength="8" class="mt-1 w-full px-3 py-2 border border-neutral-300 rounded"></label>
        <div class="pt-2 flex justify-end gap-2">
          <button type="button" id="hdr-pw-cancel" class="px-4 py-2 bg-neutral-100 rounded hover:bg-neutral-200">Cancelar</button>
          <button type="submit" class="px-4 py-2 bg-[#0A66FF] text-white rounded hover:bg-blue-700">Guardar</button>
        </div>
      </form>
    `);
    document.getElementById('hdr-pw-cancel').addEventListener('click', closeModal);
    document.getElementById('hdr-pw-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      if (f.nueva.value !== f.confirmar.value) return toast('Las contraseñas no coinciden', 'error');
      try {
        await API.put('/api/auth/password', { current_password: f.current.value, new_password: f.nueva.value });
        closeModal();
        toast('Contraseña actualizada', 'success');
      } catch (err) {
        toast(err && err.status === 401 ? 'La contraseña actual es incorrecta' : 'No se pudo cambiar la contraseña', 'error');
      }
    });
  }

  function showCreateUser() {
    openModal('Crear usuario', `
      <form id="hdr-cu-form" class="space-y-3 text-sm">
        <label class="block"><span class="text-neutral-500 text-xs">Nombre completo</span>
          <input name="full_name" required class="mt-1 w-full px-3 py-2 border border-neutral-300 rounded"></label>
        <label class="block"><span class="text-neutral-500 text-xs">Correo</span>
          <input name="email" type="email" required class="mt-1 w-full px-3 py-2 border border-neutral-300 rounded"></label>
        <label class="block"><span class="text-neutral-500 text-xs">Contraseña (mín. 8)</span>
          <input name="password" type="password" required minlength="8" class="mt-1 w-full px-3 py-2 border border-neutral-300 rounded"></label>
        <label class="block"><span class="text-neutral-500 text-xs">Rol</span>
          <select name="role" class="mt-1 w-full px-3 py-2 border border-neutral-300 rounded">
            <option value="operator">Operador</option>
            <option value="viewer">Visor</option>
            <option value="admin">Administrador</option>
          </select></label>
        <div class="pt-2 flex justify-end gap-2">
          <button type="button" id="hdr-cu-cancel" class="px-4 py-2 bg-neutral-100 rounded hover:bg-neutral-200">Cancelar</button>
          <button type="submit" class="px-4 py-2 bg-[#0A66FF] text-white rounded hover:bg-blue-700">Crear</button>
        </div>
      </form>
    `);
    document.getElementById('hdr-cu-cancel').addEventListener('click', closeModal);
    document.getElementById('hdr-cu-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await API.post('/api/users', {
          full_name: f.full_name.value, email: f.email.value,
          password: f.password.value, role: f.role.value,
        });
        closeModal();
        toast('Usuario creado', 'success');
      } catch (err) {
        toast(err && err.status === 409 ? 'Ese correo ya existe' : 'No se pudo crear el usuario', 'error');
      }
    });
  }

  async function doLogout() {
    try { await API.post('/api/auth/logout', { refresh_token: localStorage.getItem('refresh_token') }); } catch (e) {}
    clearSession();
    window.location.replace('/index.html');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
