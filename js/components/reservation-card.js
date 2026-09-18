import { formatDate, renderBadge, escapeHtml } from '../ui.js';

/**
 * Returns HTML string for a reservation card.
 * @param {Object} reservation - The reservation object, must include joined spaces.
 * @param {Array} actions - Array of actions, e.g., [{label: 'Cancelar', class: 'btn--danger btn--sm', action: 'cancel'}]
 * @returns {string} HTML string
 */
export function renderReservationCard(reservation, actions = []) {
  const spaceName = reservation.spaces ? reservation.spaces.name : 'Espacio Desconocido';
  const startDate = new Date(reservation.start_time);
  const endDate = new Date(reservation.end_time);
  
  const timeString = `${formatDate(startDate)} - ${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
  
  const notesHtml = reservation.notes 
    ? `<p class="res-card-notes"><strong>Notas:</strong> ${escapeHtml(reservation.notes)}</p>` 
    : '';

  let actionsHtml = '';
  if (actions && actions.length > 0) {
    actionsHtml = '<div class="res-card-actions">';
    actions.forEach(act => {
      actionsHtml += `<button type="button" class="btn ${act.class}" data-action="${act.action}" data-id="${reservation.id}">${escapeHtml(act.label)}</button>`;
    });
    actionsHtml += '</div>';
  }

  return `
    <div class="reservation-card card" data-id="${reservation.id}">
      <div class="res-card-header">
        <h4 class="res-card-title">${escapeHtml(spaceName)}</h4>
        ${renderBadge(reservation.status)}
      </div>
      <div class="res-card-body">
        <p class="res-card-time"><i class="icon-clock"></i> ${timeString}</p>
        ${notesHtml}
      </div>
      ${actionsHtml}
    </div>
  `;
}
