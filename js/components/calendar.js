import { supabase } from '../supabase.js';
import { showToast, formatDate } from '../ui.js';

let realtimeChannel = null;
let currentWeekBaseDate = new Date();

/**
 * Renders the calendar in the given container.
 * @param {string} containerId - The ID of the container element.
 * @param {string} spaceId - The ID of the space to fetch reservations for.
 * @param {function} onSlotClick - Callback when a free slot is clicked: onSlotClick(date, startHour, endHour).
 */
export async function renderCalendar(containerId, spaceId, onSlotClick) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Render basic skeleton
  container.innerHTML = `
    <div class="calendar-header">
      <button id="cal-prev-btn" class="btn btn--sm">Anterior</button>
      <h3 id="cal-week-label"></h3>
      <button id="cal-next-btn" class="btn btn--sm">Siguiente</button>
    </div>
    <div class="calendar-grid" id="cal-grid"></div>
  `;

  document.getElementById('cal-prev-btn').addEventListener('click', () => {
    currentWeekBaseDate.setDate(currentWeekBaseDate.getDate() - 7);
    loadCalendarData(containerId, spaceId, onSlotClick);
  });
  
  document.getElementById('cal-next-btn').addEventListener('click', () => {
    currentWeekBaseDate.setDate(currentWeekBaseDate.getDate() + 7);
    loadCalendarData(containerId, spaceId, onSlotClick);
  });

  // Setup Realtime Subscription
  setupRealtime(containerId, spaceId, onSlotClick);

  // Initial load
  await loadCalendarData(containerId, spaceId, onSlotClick);
}

export function destroyCalendar() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

async function loadCalendarData(containerId, spaceId, onSlotClick) {
  const dates = getWeekDates(currentWeekBaseDate);
  const startOfWeek = new Date(dates[0]);
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(dates[6]);
  endOfWeek.setHours(23, 59, 59, 999);

  document.getElementById('cal-week-label').textContent = `Semana del ${formatShortDate(dates[0])} al ${formatShortDate(dates[6])}`;

  // Fetch reservations
  const { data: reservations, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('space_id', spaceId)
    .gte('start_time', startOfWeek.toISOString())
    .lte('start_time', endOfWeek.toISOString())
    .not('status', 'eq', 'cancelada');

  if (error) {
    showToast('Error al cargar disponibilidad', 'error');
    console.error(error);
    return;
  }

  renderGrid(dates, reservations || [], onSlotClick);
}

function renderGrid(dates, reservations, onSlotClick) {
  const grid = document.getElementById('cal-grid');
  if (!grid) return;

  let html = '<div class="cal-row cal-header-row"><div class="cal-cell cal-time-label"></div>';
  dates.forEach(d => {
    html += `<div class="cal-cell cal-day-header">${formatShortDate(d)}</div>`;
  });
  html += '</div>';

  for (let hour = 8; hour < 21; hour++) {
    html += `<div class="cal-row"><div class="cal-cell cal-time-label">${hour}:00</div>`;
    dates.forEach(d => {
      // Find if there is a reservation matching this day and hour
      // Note: simplistic 1-hour slots matching starting hour for this example
      const matchingRes = reservations.find(r => {
        const rStart = new Date(r.start_time);
        return rStart.getDate() === d.getDate() && rStart.getMonth() === d.getMonth() && rStart.getFullYear() === d.getFullYear() && rStart.getHours() === hour;
      });

      let statusClass = 'calendar-slot--free';
      let title = 'Disponible';
      if (matchingRes) {
        statusClass = matchingRes.status === 'pendiente' ? 'calendar-slot--pending' : 'calendar-slot--booked';
        title = matchingRes.status === 'pendiente' ? 'Pendiente' : 'Ocupado';
      }

      html += `<div class="cal-cell calendar-slot ${statusClass}" data-date="${d.toISOString()}" data-hour="${hour}" title="${title}"></div>`;
    });
    html += '</div>';
  }

  grid.innerHTML = html;

  // Add event listeners to free slots
  const freeSlots = grid.querySelectorAll('.calendar-slot--free');
  freeSlots.forEach(slot => {
    slot.addEventListener('click', (e) => {
      const dateStr = e.target.getAttribute('data-date');
      const hour = parseInt(e.target.getAttribute('data-hour'), 10);
      const targetDate = new Date(dateStr);
      onSlotClick(targetDate, hour, hour + 1);
    });
  });
}

function setupRealtime(containerId, spaceId, onSlotClick) {
  destroyCalendar();
  realtimeChannel = supabase
    .channel(`calendar-${spaceId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations', filter: `space_id=eq.${spaceId}` }, payload => {
      loadCalendarData(containerId, spaceId, onSlotClick);
    })
    .subscribe();
}

function getWeekDates(baseDate) {
  const date = new Date(baseDate);
  const day = date.getDay() || 7; // Get current day number, converting Sun (0) to 7
  if (day !== 1) date.setHours(-24 * (day - 1)); // adjust when day is not monday
  
  const week = [];
  for (let i = 0; i < 7; i++) {
    week.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return week;
}

function formatShortDate(date) {
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  return `${days[date.getDay()]} ${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}
