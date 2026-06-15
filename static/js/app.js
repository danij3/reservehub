// app.js - Lógica del frontend: llamadas a la API, renderizado y eventos

const API = '/api';

// variables globales
let recursosGlobales   = [];
let categoriasGlobales = [];
let recursoSeleccionado = null;

// funciones de autenticación: guardar y leer el token de localStorage
function getToken()  { return localStorage.getItem('reservehub_token'); }
function getUsuario(){ return JSON.parse(localStorage.getItem('reservehub_user') || 'null'); }

function setAuth(token, usuario) {
  localStorage.setItem('reservehub_token', token);
  localStorage.setItem('reservehub_user',  JSON.stringify(usuario));
  actualizarNavbar();
}

function clearAuth() {
  localStorage.removeItem('reservehub_token');
  localStorage.removeItem('reservehub_user');
  actualizarNavbar();
}

function authHeaders() {
  const t = getToken();
  return t ? { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' }
           : { 'Content-Type': 'application/json' };
}

// wrapper de fetch que añade el token y gestiona errores de sesión
async function apiFetch(path, options = {}) {
  options.headers = { ...authHeaders(), ...(options.headers || {}) };
  const res = await fetch(API + path, options);

  if (res.status === 401) {
    clearAuth();
    mostrarToast('Sesión expirada. Inicia sesión de nuevo.', 'error');
    abrirModalAuth('login');
    throw new Error('Unauthorized');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
}

// muestra un mensaje emergente temporal
function mostrarToast(msg, tipo = 'info', duracion = 3500) {
  const container = document.getElementById('toast-container');
  const div = document.createElement('div');
  div.className = `toast ${tipo}`;
  div.textContent = msg;
  container.appendChild(div);
  setTimeout(() => div.remove(), duracion);
}

// actualiza el navbar según si hay sesión activa o no
function actualizarNavbar() {
  const user = getUsuario();
  document.getElementById('nav-guest').style.display = user ? 'none' : '';
  document.getElementById('nav-user').style.display  = user ? 'flex' : 'none';
  if (user) document.getElementById('nav-nombre').textContent = `Hola, ${user.nombre}`;
}

// carga y renderiza los botones de categoría
async function cargarCategorias() {
  try {
    const cats = await apiFetch('/categorias');
    categoriasGlobales = [{ id: null, nombre: 'Todas' }, ...cats];
  } catch {
    // Si falla, usar categorías vacías; el filtro "Todas" sigue funcionando
    categoriasGlobales = [{ id: null, nombre: 'Todas' }];
  }
  renderCategorias('Todas');
}

function renderCategorias(categoriaActiva) {
  const container = document.getElementById('categorias-container');
  container.innerHTML = '';
  categoriasGlobales.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = `btn-categoria ${cat.nombre === categoriaActiva ? 'activa' : ''}`;
    btn.textContent = cat.nombre;
    btn.onclick = () => filtrarPorCategoria(cat.nombre);
    container.appendChild(btn);
  });
}

// carga y renderiza las tarjetas de recursos
async function fetchRecursos() {
  const res = await apiFetch('/recursos');
  // la API devuelve { data: [...], total: N }
  return Array.isArray(res) ? res : (res.data || []);
}

function filtrarPorCategoria(categoria) {
  renderCategorias(categoria);
  if (categoria === 'Todas') {
    renderRecursos(recursosGlobales);
  } else {
    renderRecursos(recursosGlobales.filter(r => r.categoria === categoria));
  }
}

function renderRecursos(recursos) {
  const grid = document.getElementById('recursos-grid');
  grid.innerHTML = '';

  if (recursos.length === 0) {
    grid.innerHTML = '<p class="empty-state">No hay recursos disponibles para este filtro.</p>';
    return;
  }

  recursos.forEach(recurso => {
    const card = document.createElement('div');
    card.className = 'card';

    const estadoClase = recurso.disponible ? 'disponible' : 'ocupado';
    const estadoTexto = recurso.disponible ? 'Disponible' : 'Ocupado';
    const botonAtributos = recurso.disponible
      ? `onclick="abrirModal(${recurso.id})"`
      : 'disabled';

    card.innerHTML = `
      <div>
        <div class="card-header">
          <h3>${recurso.nombre}</h3>
          <span class="badge ${estadoClase}">${estadoTexto}</span>
        </div>
        <p style="font-size:.8rem;font-weight:bold">${recurso.categoria} • Cap. ${recurso.capacidad}</p>
        <p class="card-desc">${recurso.descripcion || ''}</p>
      </div>
      <button class="btn-card" ${botonAtributos}>
        ${recurso.disponible ? 'Reservar' : 'No disponible'}
      </button>`;
    grid.appendChild(card);
  });
}

// abre el modal de reserva para el recurso seleccionado
window.abrirModal = function(idRecurso) {
  // si no hay sesión, pedir que inicie sesión antes de reservar
  if (!getToken()) {
    mostrarToast('Debes iniciar sesión para reservar.', 'info');
    abrirModalAuth('login');
    return;
  }

  recursoSeleccionado = recursosGlobales.find(r => r.id === idRecurso);

  document.getElementById('modal-recurso-info').innerHTML = `
    <h3 style="margin-bottom:.25rem">${recursoSeleccionado.nombre}</h3>
    <p style="font-size:.875rem;color:#6b7280">${recursoSeleccionado.descripcion || ''}</p>`;

  // Limpiar form y mensajes
  document.getElementById('form-reserva').reset();
  setFormMsg('form-msg-reserva', '', '');

  // Poner fecha mínima de hoy
  document.getElementById('fecha').min = new Date().toISOString().split('T')[0];

  document.getElementById('modal-reserva').classList.remove('oculto');
};

function cerrarModal() {
  document.getElementById('modal-reserva').classList.add('oculto');
  recursoSeleccionado = null;
}

document.getElementById('close-modal').onclick = cerrarModal;
document.getElementById('modal-reserva').onclick = e => {
  if (e.target === document.getElementById('modal-reserva')) cerrarModal();
};

// envía la reserva a la API y cierra el modal si todo va bien
async function postReserva(datos) {
  return apiFetch('/reservas', {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}

document.getElementById('form-reserva').onsubmit = async e => {
  e.preventDefault();

  const datos = {
    recurso_id:    recursoSeleccionado.id,
    fecha_reserva: document.getElementById('fecha').value,
    hora_inicio:   document.getElementById('hora-inicio').value,
    hora_fin:      document.getElementById('hora-fin').value,
  };

  const btn = document.getElementById('btn-confirmar-reserva');
  btn.disabled = true;
  btn.textContent = 'Enviando…';

  try {
    await postReserva(datos);
    mostrarToast('¡Reserva creada con éxito!', 'success');
    cerrarModal();
  } catch (err) {
    const msg = err.data?.error || 'Error al crear la reserva.';
    setFormMsg('form-msg-reserva', msg, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirmar Reserva';
  }
};

// modal de login/registro
function abrirModalAuth(tab = 'login') {
  cambiarTab(tab);
  document.getElementById('modal-auth').classList.remove('oculto');
}

function cerrarModalAuth() {
  document.getElementById('modal-auth').classList.add('oculto');
  document.getElementById('form-login').reset();
  document.getElementById('form-register').reset();
  setFormMsg('msg-login', '', '');
  setFormMsg('msg-register', '', '');
}

document.getElementById('modal-auth').onclick = e => {
  if (e.target === document.getElementById('modal-auth')) cerrarModalAuth();
};

function cambiarTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('tab-login').classList.toggle('activa', isLogin);
  document.getElementById('tab-register').classList.toggle('activa', !isLogin);
  document.getElementById('panel-login').classList.toggle('activo', isLogin);
  document.getElementById('panel-register').classList.toggle('activo', !isLogin);
  document.getElementById('auth-titulo').textContent = isLogin ? 'Acceder' : 'Crear Cuenta';
}

// login: llama a /api/auth/login y guarda el token si va bien
async function submitLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-login');
  btn.disabled = true; btn.textContent = 'Entrando…';
  setFormMsg('msg-login', '', '');

  try {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email:    document.getElementById('login-email').value,
        password: document.getElementById('login-password').value,
      }),
    });
    setAuth(res.token, res.usuario);
    cerrarModalAuth();
    mostrarToast(`Bienvenido, ${res.usuario.nombre}!`, 'success');
  } catch (err) {
    setFormMsg('msg-login', err.data?.error || 'Credenciales incorrectas.', 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Entrar';
  }
}

// registro de nuevo usuario
async function submitRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-register');
  btn.disabled = true; btn.textContent = 'Creando cuenta…';
  setFormMsg('msg-register', '', '');

  try {
    await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        nombre:   document.getElementById('reg-nombre').value,
        email:    document.getElementById('reg-email').value,
        password: document.getElementById('reg-password').value,
      }),
    });
    setFormMsg('msg-register', '¡Cuenta creada! Ahora inicia sesión.', 'success');
    setTimeout(() => cambiarTab('login'), 1200);
  } catch (err) {
    setFormMsg('msg-register', err.data?.error || 'Error al registrarse.', 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Crear Cuenta';
  }
}

// cierra sesión en el servidor y limpia el token local
async function cerrarSesion() {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch { /* ignorar errores de red en logout */ }
  clearAuth();
  mostrarToast('Sesión cerrada.', 'info');
}

// modal "Mis reservas": carga y muestra las reservas del usuario
async function abrirMisReservas() {
  document.getElementById('reservas-list').innerHTML =
    '<p class="empty-state">Cargando…</p>';
  document.getElementById('modal-mis-reservas').classList.remove('oculto');
  await cargarMisReservas();
}

function cerrarMisReservas() {
  document.getElementById('modal-mis-reservas').classList.add('oculto');
}

document.getElementById('modal-mis-reservas').onclick = e => {
  if (e.target === document.getElementById('modal-mis-reservas')) cerrarMisReservas();
};

async function cargarMisReservas() {
  const lista = document.getElementById('reservas-list');
  try {
    const reservas = await apiFetch('/reservas/mis-reservas');

    if (!reservas.length) {
      lista.innerHTML = '<p class="empty-state">No tienes reservas todavía.</p>';
      return;
    }

    lista.innerHTML = '';
    reservas.forEach(r => {
      const item = document.createElement('div');
      item.className = 'reserva-item';

      const puedeCanc = r.estado !== 'cancelada';
      item.innerHTML = `
        <div class="reserva-info">
          <div class="reserva-nombre">${r.recurso_nombre}</div>
          <div class="reserva-detalle">
            ${r.fecha_reserva} · ${r.hora_inicio} – ${r.hora_fin}
          </div>
        </div>
        <span class="reserva-estado ${r.estado}">${r.estado}</span>
        ${puedeCanc
          ? `<button class="btn-cancelar" onclick="cancelarReserva(${r.id})">Cancelar</button>`
          : ''}`;
      lista.appendChild(item);
    });
  } catch {
    lista.innerHTML = '<p class="empty-state">Error al cargar las reservas.</p>';
  }
}

window.cancelarReserva = async function(id) {
  if (!confirm('¿Cancelar esta reserva?')) return;
  try {
    await apiFetch(`/reservas/${id}/estado`, {
      method: 'PATCH',
      body: JSON.stringify({ estado: 'cancelada' }),
    });
    mostrarToast('Reserva cancelada.', 'info');
    await cargarMisReservas();
  } catch (err) {
    mostrarToast(err.data?.error || 'No se pudo cancelar.', 'error');
  }
};

// muestra un mensaje de error o éxito debajo de un formulario
function setFormMsg(id, msg, tipo) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = `form-msg${msg ? ' ' + tipo : ''}`;
}

// arranque: carga categorías y recursos al abrir la página
async function init() {
  actualizarNavbar();
  await cargarCategorias();

  try {
    recursosGlobales = await fetchRecursos();
    renderRecursos(recursosGlobales);
  } catch {
    document.getElementById('recursos-grid').innerHTML =
      '<p class="empty-state">No se pudieron cargar los recursos.</p>';
  }
}

init();
