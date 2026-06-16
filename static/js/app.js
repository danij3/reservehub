// app.js - Lógica del frontend: llamadas a la API, renderizado y eventos

const API = "/api";

// variables globales
let recursosGlobales = [];
let categoriasGlobales = [];
let recursoSeleccionado = null;

// estado del timeline de disponibilidad
let slotStart = null; // índice del primer slot seleccionado
let slotEnd = null; // índice del segundo slot seleccionado
let slotsData = []; // array de { time, ocupado } generado al cargar la fecha

const SLOT_MINS = 30;
const DIA_INICIO_H = 8; // 08:00
const DIA_FIN_H = 22; // hasta 22:00 (último slot: 21:30)

// mapa de nombre de sala → imagen de cabecera
const ROOM_IMAGES = {
  "Sala de Estudio A": "/imgs/3_studying.jpg",
  "Laboratorio Cisco": "/imgs/4_cisco.jpg",
  "Aula Magna": "/imgs/8_magna.jpg",
  "Sala de Reuniones B": "/imgs/7_reunion.jpg",
  "Proyector Portátil": "/imgs/6_proyectando.jpg",
};

// genera los tiempos de cada slot: ["08:00", "08:30", ..., "21:30"]
function generarSlots() {
  const slots = [];
  for (let mins = DIA_INICIO_H * 60; mins < DIA_FIN_H * 60; mins += SLOT_MINS) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return slots;
}

function timeToMins(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minsToTime(mins) {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

// comprueba si un slot de 30min se solapa con alguna franja reservada
function slotOcupado(slotTime, franjas) {
  const sMin = timeToMins(slotTime);
  const sMax = sMin + SLOT_MINS;
  return franjas.some(
    (f) => sMin < timeToMins(f.hora_fin) && sMax > timeToMins(f.hora_inicio),
  );
}

// carga la disponibilidad del recurso para la fecha elegida y renderiza el timeline
async function cargarTimeline(fecha) {
  slotStart = null;
  slotEnd = null;
  document.getElementById("hora-inicio").value = "";
  document.getElementById("hora-fin").value = "";

  const container = document.getElementById("timeline-container");
  const slotsDiv = document.getElementById("timeline-slots");
  container.style.display = "block";
  slotsDiv.innerHTML = '<p class="timeline-loading">Cargando…</p>';
  actualizarHint();

  try {
    const data = await apiFetch(
      `/recursos/${recursoSeleccionado.id}/disponibilidad?fecha=${fecha}`,
    );
    renderTimeline(data.franjas_ocupadas);
  } catch {
    slotsDiv.innerHTML =
      '<p class="timeline-loading">No se pudo cargar la disponibilidad.</p>';
  }
}

function renderTimeline(franjas) {
  const slotsDiv = document.getElementById("timeline-slots");
  slotsDiv.innerHTML = "";

  const tiempos = generarSlots();
  slotsData = tiempos.map((t) => ({
    time: t,
    ocupado: slotOcupado(t, franjas),
  }));

  slotsData.forEach((slot, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `slot ${slot.ocupado ? "ocupado" : "libre"}`;
    btn.textContent = slot.time;
    btn.dataset.idx = idx;
    if (!slot.ocupado) btn.onclick = () => handleSlotClick(idx);
    slotsDiv.appendChild(btn);
  });
}

function handleSlotClick(idx) {
  if (slotStart === null) {
    // primer click: marcar inicio
    slotStart = idx;
    slotEnd = null;
  } else if (slotEnd === null) {
    if (idx <= slotStart) {
      // click en un slot anterior o el mismo: reiniciar con este como inicio
      slotStart = idx;
    } else {
      // comprobar que no hay ningún slot ocupado en el rango elegido
      const bloqueado = slotsData
        .slice(slotStart, idx + 1)
        .some((s) => s.ocupado);
      if (bloqueado) {
        mostrarToast("Hay un horario ocupado dentro de ese rango.", "error");
        return;
      }
      slotEnd = idx;
      document.getElementById("hora-inicio").value = slotsData[slotStart].time;
      document.getElementById("hora-fin").value = minsToTime(
        timeToMins(slotsData[slotEnd].time) + SLOT_MINS,
      );
    }
  } else {
    // ya había selección completa: reiniciar
    slotStart = idx;
    slotEnd = null;
    document.getElementById("hora-inicio").value = "";
    document.getElementById("hora-fin").value = "";
  }

  resaltarSlots();
  actualizarHint();
}

function resaltarSlots() {
  document.querySelectorAll("#timeline-slots .slot").forEach((el, idx) => {
    if (slotsData[idx].ocupado) {
      el.className = "slot ocupado";
      return;
    }

    const esStart = slotStart !== null && idx === slotStart;
    const esEnd = slotEnd !== null && idx === slotEnd;
    const enRango =
      slotStart !== null &&
      slotEnd !== null &&
      idx > slotStart &&
      idx < slotEnd;

    el.className =
      "slot" +
      (esStart ? " slot-start" : "") +
      (esEnd ? " slot-end" : "") +
      (enRango ? " en-rango" : "") +
      (!esStart && !esEnd && !enRango ? " libre" : "");
  });
}

function actualizarHint() {
  const hint = document.getElementById("timeline-hint");
  if (!hint) return;
  if (slotStart === null) {
    hint.textContent = "Pulsa un bloque libre para fijar el inicio";
    hint.classList.remove("confirmado");
  } else if (slotEnd === null) {
    hint.textContent = `Inicio: ${slotsData[slotStart].time} · Ahora selecciona el fin`;
    hint.classList.remove("confirmado");
  } else {
    const fin = minsToTime(timeToMins(slotsData[slotEnd].time) + SLOT_MINS);
    hint.textContent = `✓ ${slotsData[slotStart].time} – ${fin}`;
    hint.classList.add("confirmado");
  }
}

function resetTimeline() {
  slotStart = null;
  slotEnd = null;
  slotsData = [];
  const container = document.getElementById("timeline-container");
  if (container) container.style.display = "none";
  const hint = document.getElementById("timeline-hint");
  if (hint) {
    hint.textContent = "Pulsa un bloque libre para fijar el inicio";
    hint.classList.remove("confirmado");
  }
}

// funciones de autenticación: guardar y leer el token de localStorage
function getToken() {
  return localStorage.getItem("reservehub_token");
}
function getUsuario() {
  return JSON.parse(localStorage.getItem("reservehub_user") || "null");
}

function setAuth(token, usuario) {
  localStorage.setItem("reservehub_token", token);
  localStorage.setItem("reservehub_user", JSON.stringify(usuario));
  actualizarNavbar();
}

function clearAuth() {
  localStorage.removeItem("reservehub_token");
  localStorage.removeItem("reservehub_user");
  actualizarNavbar();
}

function authHeaders() {
  const t = getToken();
  return t
    ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

// wrapper de fetch que añade el token y gestiona errores de sesión
async function apiFetch(path, options = {}) {
  options.headers = { ...authHeaders(), ...(options.headers || {}) };
  const res = await fetch(API + path, options);

  if (res.status === 401) {
    clearAuth();
    mostrarToast("Sesión expirada. Inicia sesión de nuevo.", "error");
    abrirModalAuth("login");
    throw new Error("Unauthorized");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
}

// muestra un mensaje emergente temporal
function mostrarToast(msg, tipo = "info", duracion = 3500) {
  const container = document.getElementById("toast-container");
  const div = document.createElement("div");
  div.className = `toast ${tipo}`;
  div.textContent = msg;
  container.appendChild(div);
  setTimeout(() => div.remove(), duracion);
}

// devuelve las iniciales del nombre (máx. 2 letras)
function iniciales(nombre) {
  return nombre
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// actualiza el navbar según si hay sesión activa o no
function actualizarNavbar() {
  const user = getUsuario();
  document.getElementById("nav-guest").style.display = user ? "none" : "";
  document.getElementById("nav-user").style.display = user ? "flex" : "none";
  if (user) {
    document.getElementById("nav-nombre").textContent = user.nombre;
    document.getElementById("nav-avatar").textContent = iniciales(user.nombre);
  }
}

// abre el modal de perfil con los datos del usuario y carga sus reservas
async function abrirPerfil() {
  const user = getUsuario();
  if (!user) return;

  document.getElementById("perfil-avatar-grande").textContent = iniciales(
    user.nombre,
  );
  document.getElementById("perfil-nombre").textContent = user.nombre;
  document.getElementById("perfil-email").textContent = user.email;
  document.getElementById("perfil-rol").textContent =
    user.rol === "admin" ? "Administrador" : "Usuario";

  document.getElementById("modal-perfil").classList.remove("oculto");

  // carga las reservas del usuario en segundo plano
  const lista = document.getElementById("perfil-reservas-list");
  lista.innerHTML =
    '<p class="empty-state" style="padding:.5rem 0;font-size:.8rem">Cargando…</p>';

  try {
    const reservas = await apiFetch("/reservas/mis-reservas");

    if (!reservas.length) {
      lista.innerHTML =
        '<p class="empty-state" style="padding:.5rem 0;font-size:.8rem">Sin reservas todavía.</p>';
      return;
    }

    lista.innerHTML = "";
    reservas.forEach((r) => {
      const item = document.createElement("div");
      item.className = "perfil-reserva-item";

      // estado con punto de color sutil
      const dotColor =
        r.estado === "confirmada"
          ? "var(--success)"
          : r.estado === "cancelada"
            ? "var(--text-muted)"
            : "#b45309"; // pendiente: ámbar

      item.innerHTML = `
        <div class="perfil-reserva-info">
          <div class="perfil-reserva-nombre">${r.recurso_nombre}</div>
          <div class="perfil-reserva-detalle">${r.fecha_reserva} · ${r.hora_inicio}–${r.hora_fin}</div>
        </div>
        <span style="font-size:.7rem;font-weight:700;color:${dotColor};white-space:nowrap;text-transform:capitalize">
          ${r.estado}
        </span>`;
      lista.appendChild(item);
    });
  } catch {
    lista.innerHTML =
      '<p class="empty-state" style="padding:.5rem 0;font-size:.8rem">No se pudieron cargar.</p>';
  }
}

function cerrarPerfil() {
  document.getElementById("modal-perfil").classList.add("oculto");
}

document.getElementById("modal-perfil").onclick = (e) => {
  if (e.target === document.getElementById("modal-perfil")) cerrarPerfil();
};

// carga y renderiza los botones de categoría
async function cargarCategorias() {
  try {
    const cats = await apiFetch("/categorias");
    categoriasGlobales = [{ id: null, nombre: "Todas" }, ...cats];
  } catch {
    // Si falla, usar categorías vacías; el filtro "Todas" sigue funcionando
    categoriasGlobales = [{ id: null, nombre: "Todas" }];
  }
  renderCategorias("Todas");
}

function renderCategorias(categoriaActiva) {
  const container = document.getElementById("categorias-container");
  container.innerHTML = "";
  categoriasGlobales.forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = `btn-categoria ${cat.nombre === categoriaActiva ? "activa" : ""}`;
    btn.textContent = cat.nombre;
    btn.onclick = () => filtrarPorCategoria(cat.nombre);
    container.appendChild(btn);
  });
}

// devuelve el archivo de imagen que corresponde a cada sala por su nombre
function getCardImage(nombre) {
  const n = nombre.toLowerCase();
  if (n.includes("estudio")) return "3_studying.jpg";
  if (n.includes("cisco") || n.includes("lab")) return "4_cisco.jpg";
  if (n.includes("magna")) return "8_magna.jpg";
  if (n.includes("reuni")) return "7_reunion.jpg";
  if (n.includes("proyec")) return "6_proyectando.jpg";
  return null;
}

// carga y renderiza las tarjetas de recursos
async function fetchRecursos() {
  const res = await apiFetch("/recursos");
  // la API devuelve { data: [...], total: N }
  return Array.isArray(res) ? res : res.data || [];
}

function filtrarPorCategoria(categoria) {
  renderCategorias(categoria);
  if (categoria === "Todas") {
    renderRecursos(recursosGlobales);
  } else {
    renderRecursos(recursosGlobales.filter((r) => r.categoria === categoria));
  }
}

function renderRecursos(recursos) {
  const grid = document.getElementById("recursos-grid");
  grid.innerHTML = "";

  if (recursos.length === 0) {
    grid.innerHTML =
      '<p class="empty-state">No hay recursos disponibles para este filtro.</p>';
    return;
  }

  recursos.forEach((recurso) => {
    const card = document.createElement("div");
    card.className = "card";

    const botonAtributos = recurso.disponible
      ? `onclick="abrirModal(${recurso.id})"`
      : "disabled";

    // cabecera con imagen si existe, fondo verde oscuro si no
    const imgUrl = ROOM_IMAGES[recurso.nombre];
    const isProyector = recurso.nombre === "Proyector Portátil";
    const imgStyle = imgUrl
      ? `background-image: url('${imgUrl}'); background-size: cover; background-position: center;`
      : "background: var(--primary-hover);";
    const imgClass = isProyector ? "card-img card-img-proyector" : "card-img";

    card.innerHTML = `
      <div class="${imgClass}" style="${imgStyle}"></div>
      <div class="card-body">
        <div class="card-header">
          <h3>${recurso.nombre}</h3>
        </div>
        <p style="font-size:.8rem;font-weight:600;color:var(--text-muted)">${recurso.categoria} · Cap. ${recurso.capacidad}</p>
        <p class="card-desc">${recurso.descripcion || ""}</p>
      </div>
      <button class="btn-card" ${botonAtributos}>
        ${recurso.disponible ? "Reservar" : "No disponible"}
      </button>`;
    grid.appendChild(card);
  });
}

// abre el modal de reserva para el recurso seleccionado
window.abrirModal = function (idRecurso) {
  // si no hay sesión, pedir que inicie sesión antes de reservar
  if (!getToken()) {
    mostrarToast("Debes iniciar sesión para reservar.", "info");
    abrirModalAuth("login");
    return;
  }

  recursoSeleccionado = recursosGlobales.find((r) => r.id === idRecurso);

  document.getElementById("modal-recurso-info").innerHTML = `
    <h3 style="margin-bottom:.25rem">${recursoSeleccionado.nombre}</h3>
    <p style="font-size:.875rem;color:#6b7280">${recursoSeleccionado.descripcion || ""}</p>`;

  // limpiar form, mensajes y timeline
  document.getElementById("form-reserva").reset();
  setFormMsg("form-msg-reserva", "", "");
  resetTimeline();

  // fecha mínima de hoy
  const fechaInput = document.getElementById("fecha");
  fechaInput.min = new Date().toISOString().split("T")[0];

  // al cambiar la fecha se carga el timeline de disponibilidad
  fechaInput.onchange = () => {
    if (fechaInput.value) cargarTimeline(fechaInput.value);
    else resetTimeline();
  };

  document.getElementById("modal-reserva").classList.remove("oculto");
};

function cerrarModal() {
  document.getElementById("modal-reserva").classList.add("oculto");
  recursoSeleccionado = null;
  resetTimeline();
}

document.getElementById("close-modal").onclick = cerrarModal;
document.getElementById("modal-reserva").onclick = (e) => {
  if (e.target === document.getElementById("modal-reserva")) cerrarModal();
};

// envía la reserva a la API y cierra el modal si todo va bien
async function postReserva(datos) {
  return apiFetch("/reservas", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

document.getElementById("form-reserva").onsubmit = async (e) => {
  e.preventDefault();

  const datos = {
    recurso_id: recursoSeleccionado.id,
    fecha_reserva: document.getElementById("fecha").value,
    hora_inicio: document.getElementById("hora-inicio").value,
    hora_fin: document.getElementById("hora-fin").value,
  };

  const btn = document.getElementById("btn-confirmar-reserva");
  btn.disabled = true;
  btn.textContent = "Enviando…";

  try {
    await postReserva(datos);
    mostrarToast("¡Reserva creada con éxito!", "success");
    cerrarModal();
  } catch (err) {
    const msg = err.data?.error || "Error al crear la reserva.";
    setFormMsg("form-msg-reserva", msg, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Confirmar Reserva";
  }
};

// modal de login/registro
function abrirModalAuth(tab = "login") {
  cambiarTab(tab);
  document.getElementById("modal-auth").classList.remove("oculto");
}

function cerrarModalAuth() {
  document.getElementById("modal-auth").classList.add("oculto");
  document.getElementById("form-login").reset();
  document.getElementById("form-register").reset();
  setFormMsg("msg-login", "", "");
  setFormMsg("msg-register", "", "");
}

document.getElementById("modal-auth").onclick = (e) => {
  if (e.target === document.getElementById("modal-auth")) cerrarModalAuth();
};

function cambiarTab(tab) {
  const isLogin = tab === "login";
  document.getElementById("tab-login").classList.toggle("activa", isLogin);
  document.getElementById("tab-register").classList.toggle("activa", !isLogin);
  document.getElementById("panel-login").classList.toggle("activo", isLogin);
  document
    .getElementById("panel-register")
    .classList.toggle("activo", !isLogin);
  document.getElementById("auth-titulo").textContent = isLogin
    ? "Acceder"
    : "Crear Cuenta";
}

// login: llama a /api/auth/login y guarda el token si va bien
async function submitLogin(e) {
  e.preventDefault();
  const btn = document.getElementById("btn-login");
  btn.disabled = true;
  btn.textContent = "Entrando…";
  setFormMsg("msg-login", "", "");

  try {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: document.getElementById("login-email").value,
        password: document.getElementById("login-password").value,
      }),
    });
    setAuth(res.token, res.usuario);
    cerrarModalAuth();
    mostrarToast(`Bienvenido, ${res.usuario.nombre}!`, "success");
  } catch (err) {
    setFormMsg(
      "msg-login",
      err.data?.error || "Credenciales incorrectas.",
      "error",
      "/imgs/2.jpg",
    );
  } finally {
    btn.disabled = false;
    btn.textContent = "Entrar";
  }
}

// registro de nuevo usuario
async function submitRegister(e) {
  e.preventDefault();
  const btn = document.getElementById("btn-register");
  btn.disabled = true;
  btn.textContent = "Creando cuenta…";
  setFormMsg("msg-register", "", "");

  try {
    await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        nombre: document.getElementById("reg-nombre").value,
        email: document.getElementById("reg-email").value,
        password: document.getElementById("reg-password").value,
      }),
    });
    setFormMsg(
      "msg-register",
      "¡Cuenta creada! Ahora inicia sesión.",
      "success",
    );
    setTimeout(() => cambiarTab("login"), 1200);
  } catch (err) {
    setFormMsg(
      "msg-register",
      err.data?.error || "Error al registrarse.",
      "error",
    );
  } finally {
    btn.disabled = false;
    btn.textContent = "Crear Cuenta";
  }
}

// cierra sesión en el servidor y limpia el token local
async function cerrarSesion() {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } catch {
    /* ignorar errores de red en logout */
  }
  clearAuth();
  mostrarToast("Sesión cerrada.", "info");
}

// abre el login sin cerrar la sesión actual; si el nuevo login tiene éxito, setAuth() la sobreescribe
function cambiarUsuario() {
  abrirModalAuth("login");
}

// alterna entre vista cuadrícula (3 col) y vista lista (1 col horizontal)
function setVista(modo) {
  const grid = document.getElementById("recursos-grid");
  const btnGrid = document.getElementById("btn-grid");
  const btnLista = document.getElementById("btn-lista");

  if (modo === "grid") {
    grid.classList.remove("vista-lista");
    btnGrid.classList.add("activa");
    btnLista.classList.remove("activa");
  } else {
    grid.classList.add("vista-lista");
    btnLista.classList.add("activa");
    btnGrid.classList.remove("activa");
  }
}

// modal "Mis reservas": carga y muestra las reservas del usuario
async function abrirMisReservas() {
  document.getElementById("reservas-list").innerHTML =
    '<p class="empty-state">Cargando…</p>';
  document.getElementById("modal-mis-reservas").classList.remove("oculto");
  await cargarMisReservas();
}

function cerrarMisReservas() {
  document.getElementById("modal-mis-reservas").classList.add("oculto");
}

document.getElementById("modal-mis-reservas").onclick = (e) => {
  if (e.target === document.getElementById("modal-mis-reservas"))
    cerrarMisReservas();
};

async function cargarMisReservas() {
  const lista = document.getElementById("reservas-list");
  try {
    const reservas = await apiFetch("/reservas/mis-reservas");

    if (!reservas.length) {
      lista.innerHTML =
        '<p class="empty-state">No tienes reservas todavía.</p>';
      return;
    }

    lista.innerHTML = "";
    reservas.forEach((r) => {
      const item = document.createElement("div");
      item.className = "reserva-item";

      const puedeCanc = r.estado !== "cancelada";
      item.innerHTML = `
        <div class="reserva-info">
          <div class="reserva-nombre">${r.recurso_nombre}</div>
          <div class="reserva-detalle">
            ${r.fecha_reserva} · ${r.hora_inicio} – ${r.hora_fin}
          </div>
        </div>
        <span class="reserva-estado ${r.estado}">${r.estado}</span>
        ${
          puedeCanc
            ? `<button class="btn-cancelar" onclick="cancelarReserva(${r.id})">Cancelar</button>`
            : ""
        }`;
      lista.appendChild(item);
    });
  } catch {
    lista.innerHTML =
      '<p class="empty-state">Error al cargar las reservas.</p>';
  }
}

window.cancelarReserva = async function (id) {
  if (!confirm("¿Cancelar esta reserva?")) return;
  try {
    await apiFetch(`/reservas/${id}/estado`, {
      method: "PATCH",
      body: JSON.stringify({ estado: "cancelada" }),
    });
    mostrarToast("Reserva cancelada.", "info");
    await cargarMisReservas();
  } catch (err) {
    mostrarToast(err.data?.error || "No se pudo cancelar.", "error");
  }
};

// muestra un mensaje de error o éxito debajo de un formulario
// si se pasa "imagen", se muestra una miniatura junto al texto
function setFormMsg(id, msg, tipo, imagen) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `form-msg${msg ? " " + tipo : ""}`;
  if (msg && imagen) {
    el.innerHTML = `
      <img src="${imagen}" alt="" class="form-msg-img" />
      <span>${msg}</span>`;
  } else {
    el.textContent = msg;
  }
}

// arranque: carga categorías y recursos al abrir la página
async function init() {
  actualizarNavbar();
  await cargarCategorias();

  try {
    recursosGlobales = await fetchRecursos();
    renderRecursos(recursosGlobales);
  } catch {
    document.getElementById("recursos-grid").innerHTML =
      '<p class="empty-state">No se pudieron cargar los recursos.</p>';
  }
}

init();
