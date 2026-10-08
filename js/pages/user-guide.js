import { getCurrentUser } from '../auth.js';

export function render() {
  return `
    <div class="page-container user-guide-page">
      <header class="user-guide-hero">
        <p class="eyebrow">SUPERGOL · AYUDA</p>
        <h1>Manual de usuario</h1>
        <p>Conoce el complejo, crea tus reservas y consulta su estado desde tu cuenta.</p>
      </header>

      <section class="manual-section">
        <div class="manual-section__title"><span>01</span><h2>Conoce Super Gol</h2></div>
        <div class="manual-grid">
          <article class="manual-card"><span class="manual-card__icon">⌖</span><h3>Instalaciones y ubicación</h3><p>En <strong>Lugar</strong> puedes consultar la dirección del complejo, abrir cómo llegar y ver las fotos disponibles. Toca una foto para ampliarla.</p></article>
          <article class="manual-card"><span class="manual-card__icon">⚽</span><h3>Espacios deportivos</h3><p>En Inicio encontrarás la cancha de fútbol, la pista de motocross, la mesa de billar y la tienda. Selecciona un espacio para comenzar una reserva.</p></article>
        </div>
      </section>

      <section class="manual-section">
        <div class="manual-section__title"><span>02</span><h2>Antes de iniciar sesión</h2></div>
        <div class="manual-grid">
          <article class="manual-card"><span class="manual-card__icon">1</span><h3>Crear una cuenta</h3><p>Selecciona <strong>Registrarse</strong> en el inicio y completa tu nombre, teléfono, correo y contraseña.</p></article>
          <article class="manual-card"><span class="manual-card__icon">2</span><h3>Iniciar sesión</h3><p>Usa el correo y la contraseña registrados para entrar a tu cuenta. Si no recuerdas tu clave, utiliza la opción para recuperarla en el inicio de sesión.</p></article>
        </div>
      </section>

      <section class="manual-section">
        <div class="manual-section__title"><span>03</span><h2>Crear una reserva</h2></div>
        <div class="manual-grid manual-grid--three">
          <article class="manual-card"><span class="manual-card__icon">1</span><h3>Elige el espacio</h3><p>Entra en <strong>Reservar</strong> y selecciona fútbol, motocross o billar.</p></article>
          <article class="manual-card"><span class="manual-card__icon">2</span><h3>Indica el horario</h3><p>Selecciona una fecha disponible, una hora de inicio y una duración de 1, 2 o 3 horas. La reserva debe ser futura y respetar el horario del complejo.</p></article>
          <article class="manual-card"><span class="manual-card__icon">3</span><h3>Confirma los datos</h3><p>Escribe el nombre y el teléfono de contacto y confirma la solicitud. La reserva queda pendiente hasta que el equipo la revise; si el horario ya está ocupado, el sistema te avisará.</p></article>
        </div>
      </section>

      <section class="manual-section">
        <div class="manual-section__title"><span>04</span><h2>Administrar tus reservas</h2></div>
        <div class="manual-actions">
          <div><strong>Filtrar y consultar</strong><p>Entra en <strong>Mis Reservas</strong> y usa las pestañas para ver todas, pendientes, aprobadas o completadas. Los cambios de estado se reflejan en tu lista.</p></div>
          <div><strong>Actualizar una pendiente</strong><p>En una reserva pendiente puedes editar el día, la hora, la duración y las notas. El nuevo horario debe ser futuro y estar disponible.</p></div>
          <div><strong>Eliminar</strong><p>Puedes eliminar una solicitud pendiente o quitar una reserva completada de tu historial. Confirma la acción cuando se solicite; una reserva completada se elimina permanentemente del historial.</p></div>
        </div>
      </section>

      <a class="manual-back-link" href="#/">← Volver al inicio</a>
    </div>
  `;
}

export async function init() {
  await getCurrentUser();
}
