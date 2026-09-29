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
    { key: 'devices', label: 'Equipos', href: '/dashboard.html' },
    { key: 'galeria', label: 'Galería', href: '/gallery.html' },
    { key: 'graficas', label: 'Gráficas', href: '/graficas.html' },
    { key: 'ajustar-texto', label: 'Ajustar texto', href: '/ajustar-texto.html' },
    { key: 'programacion', label: 'Programación', href: '/scheduler.html' },
    { key: 'campanas', label: 'Campañas', href: '/campaigns.html' },
    { key: 'verificacion', label: 'Verificación', href: '/verification.html' },
    { key: 'fallas', label: 'Fallas', href: '/fallas.html' },
  ];

  function activeKey() {
    const p = location.pathname;
    if (p.includes('gallery')) return 'galeria';
    if (p.includes('graficas')) return 'graficas';
    if (p.includes('ajustar-texto')) return 'ajustar-texto';
    if (p.includes('scheduler')) return 'programacion';
    if (p.includes('campaigns')) return 'campanas';
    if (p.includes('verification')) return 'verificacion';
    if (p.includes('fallas')) return 'fallas';
    return 'devices'; // dashboard y device-detail
  }

  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function navLinks(active, mobile) {
    return NAV.map((n) => {
      const on = n.key === active;
      // Activa: tinta con subrayado azul (el azul es el unico color de producto).
      const cls = mobile
        ? `block px-4 py-2.5 text-sm ${on ? 'text-neutral-900 font-medium bg-blue-50 border-l-2 border-blue-600' : 'text-neutral-600 hover:bg-neutral-50'}`
        : `py-5 -mb-px border-b-2 ${on ? 'text-neutral-900 font-medium border-blue-600' : 'text-neutral-500 border-transparent hover:text-neutral-900'}`;
      // Las fallas abiertas se cuentan en el menu: es lo primero que hay que ver.
      const globo = n.key === 'fallas' ? ' <span data-fallas-abiertas class="hidden ml-1 px-1.5 rounded-full bg-red-600 text-white text-[10px] font-semibold align-middle"></span>' : '';
      return `<a href="${n.href}" class="${cls}">${n.label}${globo}</a>`;
    }).join('');
  }

  function render() {
    const mount = document.getElementById('app-header');
    if (!mount) return;
    const active = activeKey();

    mount.innerHTML = `
    <header class="bg-white border-b border-neutral-200 sticky top-0 z-30">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <!-- Marca: wordmark + endoso en mono (Brand Book: endosar sin fusionar) -->
        <a href="/dashboard.html" class="flex items-baseline gap-2 shrink-0">
          <span class="se-titulo text-[19px] tracking-[0.02em] text-neutral-900">SPACE EYES</span>
          <span class="hidden sm:inline font-mono text-[10.5px] text-neutral-500">by AS Network</span>
        </a>
        <!-- Nav desktop -->
        <nav class="hidden lg:flex items-center gap-5 text-sm self-stretch">${navLinks(active, false)}</nav>
        <!-- Derecha -->
        <div class="flex items-center gap-3 sm:gap-4">
          <span class="hidden xl:inline-flex items-center gap-1.5 text-xs text-neutral-500 whitespace-nowrap border border-neutral-200 rounded-full px-2.5 py-1">
            <span class="w-1.5 h-1.5 rounded-full bg-green-600"></span>
            <span id="hdr-online" class="font-mono text-neutral-900">–</span> en línea de
            <span id="hdr-total" class="font-mono text-neutral-900">–</span>
          </span>
          <!-- Usuario -->
          <div class="relative">
            <button id="hdr-user-btn" class="flex items-center gap-2 rounded-full hover:bg-neutral-100 pl-1 pr-2 py-1">
              <span id="hdr-avatar" class="w-8 h-8 rounded-full bg-neutral-900 text-white text-sm font-medium flex items-center justify-center">?</span>
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
          <span id="hdr-online-m" class="font-mono text-neutral-900">–</span> en línea de <span id="hdr-total-m" class="font-mono text-neutral-900">–</span>
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

  // Confirmacion fuerte para lo que NO se puede deshacer: no basta con aceptar,
  // hay que escribir la palabra. Un dispositivo borrado se lleva sus fotos, su
  // telemetria y su historial; un clic de mas no deberia poder hacer eso.
  // Devuelve una promesa que resuelve a true solo si se escribio la palabra.
  // Queda en window para que cualquier pagina la use (shell.js carga en todas).
  function confirmarEscribiendo({ titulo, mensaje, detalle, palabra = 'ELIMINAR', textoBoton = 'Eliminar' }) {
    return new Promise((resolve) => {
      openModal(titulo, `
        <div class="space-y-4 text-sm">
          <div class="flex gap-3 p-3 bg-red-50 border border-red-200 rounded">
            <svg class="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
            <div>
              <div class="font-medium text-red-800">${esc(mensaje)}</div>
              ${detalle ? `<div class="text-red-700 mt-1">${esc(detalle)}</div>` : ''}
            </div>
          </div>
          <div>
            <label class="block text-neutral-600 mb-1">Para confirmar, escribe <b class="text-neutral-900">${esc(palabra)}</b></label>
            <input id="hdr-conf-input" autocomplete="off" spellcheck="false"
                   class="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                   placeholder="${esc(palabra)}">
          </div>
          <div class="flex justify-end gap-2 pt-1">
            <button id="hdr-conf-cancel" class="px-4 py-2 bg-neutral-100 rounded hover:bg-neutral-200">Cancelar</button>
            <button id="hdr-conf-ok" disabled class="px-4 py-2 rounded text-white bg-red-300 cursor-not-allowed">${esc(textoBoton)}</button>
          </div>
        </div>
      `);

      const input = document.getElementById('hdr-conf-input');
      const ok = document.getElementById('hdr-conf-ok');
      const cerrar = document.getElementById('hdr-modal-close');

      let listo = false;
      const alCerrar = () => terminar(false);
      function terminar(valor) {
        if (listo) return;
        listo = true;
        cerrar.removeEventListener('click', alCerrar);
        closeModal();
        resolve(valor);
      }

      // Se acepta con o sin mayusculas y sin importar espacios de sobra, pero
      // tiene que ser la palabra: no vale cualquier cosa.
      const coincide = () => input.value.trim().toUpperCase() === String(palabra).toUpperCase();
      const revisar = () => {
        const v = coincide();
        ok.disabled = !v;
        ok.className = `px-4 py-2 rounded text-white ${v ? 'bg-red-600 hover:bg-red-700' : 'bg-red-300 cursor-not-allowed'}`;
      };

      input.addEventListener('input', revisar);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && coincide()) terminar(true); });
      ok.addEventListener('click', () => { if (coincide()) terminar(true); });
      document.getElementById('hdr-conf-cancel').addEventListener('click', () => terminar(false));
      cerrar.addEventListener('click', alCerrar);
      setTimeout(() => input.focus(), 50);
    });
  }
  window.confirmarEscribiendo = confirmarEscribiendo;
  // El aviso flotante tambien queda disponible para las paginas: antes cada una
  // resolvia sus mensajes con alert(), que corta la pagina y se ve de 1998.
  window.toast = toast;

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

  // Cuantas fallas de pantalla hay abiertas, en el menu. Una peticion por pagina;
  // las paginas que escuchan el socket lo refrescan con window.contarFallas().
  async function contarFallas() {
    try {
      const r = await API.get('/api/fallas?estado=abierta&limit=1');
      document.querySelectorAll('[data-fallas-abiertas]').forEach((b) => {
        b.textContent = r.abiertas;
        b.classList.toggle('hidden', !r.abiertas);
      });
    } catch (e) { /* sin sesion o sin red: el menu sigue sin numero */ }
  }
  window.contarFallas = contarFallas;

  function arrancar() { render(); contarFallas(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
})();
