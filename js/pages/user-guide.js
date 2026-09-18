import { getCurrentUser } from '../auth.js';

export function render() {
  return `
    <div class="page-container user-guide-page">
      <header class="user-guide-hero">
        <p class="eyebrow">SUPERGOL · AYUDA</p>
        <h1>Manual de usuario</h1>
        <p>Todo lo que necesitas para crear y administrar tus reservas.</p>
      </header>

      <section class="manual-section">
        <div class="manual-section__title"><span>01</span><h2>Antes de iniciar sesión</h2></div>
        <div class="manual-grid">
          <article class="manual-card"><span class="manual-card__icon">1</span><h3>Crear una cuenta</h3><p>Selecciona <strong>Registrarse</strong> en el inicio y completa tu nombre, teléfono, correo y contraseña.</p></article>
          <article class="manual-card"><span class="manual-card__icon">2</span><h3>Iniciar sesión</h3><p>Usa el correo y la contraseña registrados para entrar a tu cuenta.</p></article>
        </div>
      </section>

      <section class="manual-section">
        <div class="manual-section__title"><span>02</span><h2>Crear una reserva</h2></div>
        <div class="manual-grid manual-grid--three">
          <article class="manual-card"><span class="manual-card__icon">1</span><h3>Elige el espacio</h3><p>Entra en <strong>Reservar</strong> y selecciona fútbol, motocross o billar.</p></article>
          <article class="manual-card"><span class="manual-card__icon">2</span><h3>Indica el horario</h3><p>Selecciona el día, la hora de inicio y la duración de tu actividad.</p></article>
          <article class="manual-card"><span class="manual-card__icon">3</span><h3>Confirma los datos</h3><p>Escribe el nombre y teléfono del cliente y confirma la solicitud.</p></article>
        </div>
      </section>

      <section class="manual-section">
        <div class="manual-section__title"><span>03</span><h2>Administrar tus reservas</h2></div>
        <div class="manual-actions">
          <div><strong>Consultar</strong><p>Entra en <strong>Mis Reservas</strong> para ver el estado de cada solicitud.</p></div>
          <div><strong>Actualizar</strong><p>En una reserva pendiente puedes cambiar el día, hora de inicio y duración.</p></div>
          <div><strong>Eliminar</strong><p>Presiona eliminar y confirma para borrar la reserva de tu cuenta.</p></div>
        </div>
      </section>

      <a class="manual-back-link" href="#/">← Volver al inicio</a>
    </div>
  `;
}

export async function init() {
  await getCurrentUser();
}
