// admin.js - Lógica del panel de administración: reservas por sala y
// creación de nuevas salas.
//
// admin.html es una página independiente de index.html, así que aquí se
// duplican (mínimamente) las funciones de autenticación de app.js en vez de
// incluir app.js entero, ya que app.js asume elementos del DOM (modales,
// grid de recursos) que no existen en esta página.

const API = "/api";

// --- Autenticación: la sesión real vive en una cookie httpOnly que pone el
// servidor; aquí solo se cachea el perfil del usuario (no sensible) en
// localStorage, con la misma clave que usa app.js, para pintar la UI. ---
function getUsuario() {
  return JSON.parse(localStorage.getItem("reservehub_user") || "null");
}
function clearAuth() {
  localStorage.removeItem("reservehub_user");
}

// wrapper de fetch para peticiones JSON: incluye la cookie de sesión (same-origin)
async function apiFetch(path, options = {}) {
  options.headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  options.credentials = "same-origin";
  const res = await fetch(API + path, options);

  if (res.status === 401) {
    clearAuth();
    mostrarToast("Sesión expirada. Inicia sesión de nuevo.", "error");
    setTimeout(() => (window.location.href = "/"), 800);
    throw new Error("Unauthorized");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
}

// wrapper de fetch para enviar FormData (multipart, p.ej. subida de imagen).
// No se fuerza Content-Type: el navegador añade el boundary correcto solo.
// La cookie de sesión viaja igual, incluida con credentials: same-origin.
async function apiFetchForm(path, formData, method = "POST") {
  const res = await fetch(API + path, {
    method,
    credentials: "same-origin",
    body: formData,
  });

  if (res.status === 401) {
    clearAuth();
    mostrarToast("Sesión expirada. Inicia sesión de nuevo.", "error");
    setTimeout(() => (window.location.href = "/"), 800);
    throw new Error("Unauthorized");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
}

function mostrarToast(msg, tipo = "info", duracion = 3500) {
  const container = document.getElementById("toast-container");
  const div = document.createElement("div");
  div.className = `toast ${tipo}`;
  div.textContent = msg;
  container.appendChild(div);
  setTimeout(() => div.remove(), duracion);
}

function setFormMsg(id, msg, tipo) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `form-msg${msg ? " " + tipo : ""}`;
  el.textContent = msg;
}

async function cerrarSesionAdmin() {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } catch {
    /* ignorar errores de red en logout */
  }
  clearAuth();
  window.location.href = "/";
}

// --- Guard de acceso ---
// La protección real de los datos vive en cada endpoint /api/* (decorador
// admin_required en el backend). Este guard de cliente solo evita que un
// usuario normal vea la interfaz del panel; si alguien fuerza la URL sin
// ser admin, todas sus llamadas a /api/recursos (POST), /api/usuarios,
// etc. serán rechazadas igualmente por el servidor con 403.
function comprobarAcceso() {
  const user = getUsuario();
  if (!user || user.rol !== "admin") {
    window.location.href = "/?acceso_denegado=1";
    return false;
  }
  return true;
}

// --- Estado global ---
let salasGlobales = [];
let usuariosGlobales = [];
let categoriasGlobales = [];

// carga las salas, usuarios y categorías necesarias para poblar los <select>
async function cargarSalasYUsuarios() {
  try {
    const res = await apiFetch("/recursos");
    salasGlobales = Array.isArray(res) ? res : res.data || [];
  } catch {
    salasGlobales = [];
  }

  try {
    usuariosGlobales = await apiFetch("/usuarios");
  } catch {
    usuariosGlobales = [];
  }

  try {
    categoriasGlobales = await apiFetch("/categorias");
  } catch {
    categoriasGlobales = [];
  }

  poblarSelectSalas();
  poblarSelectUsuarios();
  poblarSelectCategorias();
}

function poblarSelectSalas() {
  const sel = document.getElementById("filtro-sala");
  const valorPrevio = sel.value;
  sel.innerHTML = '<option value="">Todas las salas</option>';
  salasGlobales.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.nombre;
    sel.appendChild(opt);
  });
  sel.value = valorPrevio;
}

function poblarSelectUsuarios() {
  const sel = document.getElementById("filtro-usuario");
  const valorPrevio = sel.value;
  sel.innerHTML = '<option value="">Todos los usuarios</option>';
  usuariosGlobales.forEach((u) => {
    const opt = document.createElement("option");
    opt.value = u.id;
    opt.textContent = `${u.nombre} (${u.email})`;
    sel.appendChild(opt);
  });
  sel.value = valorPrevio;
}

function poblarSelectCategorias() {
  const sel = document.getElementById("sala-categoria");
  sel.innerHTML = '<option value="">Selecciona una categoría</option>';
  categoriasGlobales.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.nombre;
    sel.appendChild(opt);
  });
}

// --- Reservas agrupadas por sala ---

// etiqueta legible para cada estado en la UI; el valor real guardado en BD
// sigue siendo pendiente/confirmada/cancelada (no se toca el backend)
const ETIQUETAS_ESTADO = {
  pendiente: "Pendiente",
  confirmada: "Aprobada",
  cancelada: "Cancelada",
};

async function cargarReservasAdmin() {
  const container = document.getElementById("admin-reservas-grouped");
  container.innerHTML = '<p class="empty-state">Cargando…</p>';

  const params = new URLSearchParams();
  const sala = document.getElementById("filtro-sala").value;
  const fecha = document.getElementById("filtro-fecha").value;
  const usuario = document.getElementById("filtro-usuario").value;
  if (sala) params.set("recurso_id", sala);
  if (fecha) params.set("fecha_reserva", fecha);
  if (usuario) params.set("usuario_id", usuario);

  const qs = params.toString();

  try {
    const reservas = await apiFetch("/reservas" + (qs ? `?${qs}` : ""));
    renderReservasAgrupadas(reservas);
  } catch {
    container.innerHTML =
      '<p class="empty-state">No se pudieron cargar las reservas.</p>';
  }
}

function renderReservasAgrupadas(reservas) {
  const container = document.getElementById("admin-reservas-grouped");
  container.innerHTML = "";

  if (!reservas.length) {
    container.innerHTML =
      '<p class="empty-state">No hay reservas para este filtro.</p>';
    return;
  }

  // agrupar por recurso_id conservando el orden de aparición
  const grupos = new Map();
  reservas.forEach((r) => {
    if (!grupos.has(r.recurso_id)) grupos.set(r.recurso_id, []);
    grupos.get(r.recurso_id).push(r);
  });

  grupos.forEach((lista, recursoId) => {
    const sala = salasGlobales.find((s) => s.id === recursoId);
    const detalleSala = sala
      ? ` <span class="admin-sala-meta">· Categoría: ${sala.categoria}${
          sala.numero_sala ? `, Nº ${sala.numero_sala}` : ""
        }</span>`
      : "";
    const nombreSala = sala ? sala.nombre : lista[0].recurso_nombre;

    const grupo = document.createElement("div");
    grupo.className = "admin-sala-grupo";
    grupo.innerHTML = `
      <h3 class="admin-sala-titulo">${nombreSala}${detalleSala}</h3>
      <div class="admin-tabla-wrap">
        <table class="admin-tabla-reservas">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Fecha</th>
              <th>Hora inicio</th>
              <th>Hora fin</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${lista
              .map(
                (r) => `
              <tr>
                <td>${r.usuario_nombre}</td>
                <td>${r.fecha_reserva}</td>
                <td>${r.hora_inicio}</td>
                <td>${r.hora_fin}</td>
                <td><span class="admin-estado-badge admin-estado-${r.estado}">${
                  ETIQUETAS_ESTADO[r.estado] || r.estado
                }</span></td>
                <td class="admin-acciones-cell">
                  ${
                    r.estado !== "confirmada"
                      ? `<button type="button" class="admin-btn-accion admin-btn-aprobar" data-id="${r.id}" data-estado="confirmada">Aprobar</button>`
                      : ""
                  }
                  ${
                    r.estado !== "cancelada"
                      ? `<button type="button" class="admin-btn-accion admin-btn-cancelar" data-id="${r.id}" data-estado="cancelada">Cancelar</button>`
                      : ""
                  }
                  <button type="button" class="admin-btn-accion admin-btn-borrar" data-id="${r.id}">Borrar</button>
                </td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>`;
    container.appendChild(grupo);
  });
}

// delegación de eventos: las filas se regeneran en cada carga, así que el
// listener vive en el contenedor fijo en vez de en cada botón
document
  .getElementById("admin-reservas-grouped")
  .addEventListener("click", async (e) => {
    const btn = e.target.closest(".admin-btn-accion");
    if (!btn) return;
    const id = btn.dataset.id;

    if (btn.classList.contains("admin-btn-borrar")) {
      const confirmado = confirm(
        "¿Borrar esta reserva de forma permanente? Esta acción no se puede deshacer.",
      );
      if (!confirmado) return;
      try {
        await apiFetch(`/reservas/${id}`, { method: "DELETE" });
        mostrarToast("Reserva eliminada permanentemente.", "success");
        await cargarReservasAdmin();
      } catch (err) {
        mostrarToast(
          err?.data?.error || "No se pudo eliminar la reserva.",
          "error",
        );
      }
      return;
    }

    // aprobar / cancelar: cambia el estado, no borra la fila
    const nuevoEstado = btn.dataset.estado;
    try {
      await apiFetch(`/reservas/${id}/estado`, {
        method: "PATCH",
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      mostrarToast(
        nuevoEstado === "confirmada"
          ? "Reserva aprobada."
          : "Reserva cancelada.",
        "success",
      );
      await cargarReservasAdmin();
    } catch (err) {
      mostrarToast(
        err?.data?.error || "No se pudo actualizar la reserva.",
        "error",
      );
    }
  });

document
  .getElementById("filtro-sala")
  .addEventListener("change", cargarReservasAdmin);
document
  .getElementById("filtro-fecha")
  .addEventListener("change", cargarReservasAdmin);
document
  .getElementById("filtro-usuario")
  .addEventListener("change", cargarReservasAdmin);
document.getElementById("btn-limpiar-filtros").addEventListener("click", () => {
  document.getElementById("filtro-sala").value = "";
  document.getElementById("filtro-fecha").value = "";
  document.getElementById("filtro-usuario").value = "";
  cargarReservasAdmin();
});

// --- Vista previa de la imagen seleccionada ---
document.getElementById("sala-imagen").addEventListener("change", (e) => {
  const file = e.target.files[0];
  const preview = document.getElementById("preview-imagen-sala");
  preview.src = file ? URL.createObjectURL(file) : "/imgs/2.jpg";
});

// --- Crear nueva sala ---
document
  .getElementById("form-nueva-sala")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    setFormMsg("msg-nueva-sala", "", "");

    const nombre = document.getElementById("sala-nombre").value.trim();
    const categoriaId = document.getElementById("sala-categoria").value;
    const numeroSala = document.getElementById("sala-numero").value.trim();

    // validación en cliente (la validación real, autoritativa, está en el
    // backend; esto solo evita una petición innecesaria)
    if (!nombre || !categoriaId || !numeroSala) {
      setFormMsg(
        "msg-nueva-sala",
        "Título, categoría y número de sala son obligatorios.",
        "error",
      );
      return;
    }

    const btn = document.getElementById("btn-crear-sala");
    btn.disabled = true;
    btn.textContent = "Creando…";

    const formData = new FormData(document.getElementById("form-nueva-sala"));

    try {
      await apiFetchForm("/recursos", formData);
      setFormMsg("msg-nueva-sala", "¡Sala creada con éxito!", "success");
      mostrarToast("Sala creada correctamente.", "success");
      document.getElementById("form-nueva-sala").reset();
      document.getElementById("preview-imagen-sala").src = "/imgs/2.jpg";
      await cargarSalasYUsuarios();
      await cargarReservasAdmin();
    } catch (err) {
      setFormMsg(
        "msg-nueva-sala",
        err?.data?.error || "No se pudo crear la sala.",
        "error",
      );
    } finally {
      btn.disabled = false;
      btn.textContent = "Crear sala";
    }
  });

// --- Arranque ---
async function init() {
  if (!comprobarAcceso()) return;

  const user = getUsuario();
  document.getElementById("admin-nombre").textContent = user.nombre;

  await cargarSalasYUsuarios();
  await cargarReservasAdmin();
}

init();
