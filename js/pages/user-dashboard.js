import { supabase } from '../supabase.js';
import { getCurrentUser } from '../auth.js';
import { showToast, showConfirm, showModal, setLoading, escapeHtml } from '../ui.js';
import { renderReservationCard } from '../components/reservation-card.js';

let realtimeChannel = null;
let currentFilter = 'all';

export async function render() {
  return `
    <div class="page-container">
      <h2 class="page-title">Mis Reservas</h2>
      
      <div class="tabs-container">
        <button class="btn btn-tab active" data-filter="all">Todas</button>
        <button class="btn btn-tab" data-filter="pendiente">Pendientes</button>
        <button class="btn btn-tab" data-filter="aprobada">Aprobadas</button>
        <button class="btn btn-tab" data-filter="completada">Completadas</button>
      </div>

      <div id="reservations-list" class="reservations-grid">
        <!-- Cards loaded here -->
      </div>
    </div>
  `;
}

export async function init() {
  const user = await getCurrentUser();
  if (!user) {
    document.getElementById('reservations-list').innerHTML = '<p>Debes iniciar sesión para ver tus reservas.</p>';
    return;
  }

  if (realtimeChannel) {
    await supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  setupTabs();
  await loadReservations();

  // Setup Realtime Subscription
  realtimeChannel = supabase
    .channel('user-reservations')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations', filter: `user_id=eq.${user.id}` }, payload => {
      loadReservations();
    })
    .subscribe();

  window.addEventListener('hashchange', () => {
    if (!window.location.hash.includes('user-dashboard')) {
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    }
  }, { once: true });
}

function setupTabs() {
  const tabs = document.querySelectorAll('.btn-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      tabs.forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.dataset.filter;
      loadReservations();
    });
  });
}

async function loadReservations() {
  const user = await getCurrentUser();
  if (!user) return;
  
  setLoading(true);
  try {
    let query = supabase
      .from('reservations')
      .select('id, space_id, user_id, start_time, end_time, status, notes, spaces(name, type)')
      .eq('user_id', user.id)
      .order('start_time', { ascending: false });

    if (currentFilter !== 'all') {
      query = query.eq('status', currentFilter);
    }

    const { data, error } = await query;
    if (error) throw error;

    const listContainer = document.getElementById('reservations-list');
    
    if (!data || data.length === 0) {
      listContainer.innerHTML = '<div class="empty-state">No tienes reservas. ¡Reserva ahora!</div>';
      return;
    }

    let html = '';
    data.forEach(res => {
      let actions = [];
      if (res.status === 'pendiente') {
        actions.push({ label: 'Actualizar', class: 'btn--primary btn--sm', action: 'edit' });
        actions.push({ label: 'Eliminar', class: 'btn--danger btn--sm', action: 'cancel' });
      }
      html += renderReservationCard(res, actions);
    });

    listContainer.innerHTML = html;
    bindActions(data);
    
  } catch (error) {
    showReservationError(error, 'cargar');
    console.error(error);
  } finally {
    setLoading(false);
  }
}

function bindActions(reservations) {
  const buttons = document.querySelectorAll('.res-card-actions button');
  buttons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const action = e.currentTarget.dataset.action;
      const id = e.currentTarget.dataset.id;
      const reservation = reservations.find(item => String(item.id) === String(id));

      if (action === 'edit' && reservation) {
        openEditModal(reservation);
        return;
      }
      
      if (action === 'cancel') {
        showConfirm('¿Eliminar esta reserva?', 'La reserva quedará cancelada y dejará de ocupar el horario.', async () => {
          const user = await getCurrentUser();
          if (!user) return;

          setLoading(true);
          try {
            const { data: deleted, error } = await supabase
              .rpc('delete_my_reservation', { p_reservation_id: Number(id) });

            if (error) throw error;
            if (!deleted) {
              throw new Error('La reserva no pertenece al usuario actual o ya fue eliminada.');
            }

            showToast('Reserva eliminada correctamente', 'success');
            await loadReservations();
          } catch (error) {
            showReservationError(error, 'eliminar');
            console.error(error);
          } finally {
            setLoading(false);
          }
        });
      }
    });
  });
}

function openEditModal(reservation) {
  const start = new Date(reservation.start_time);
  const end = new Date(reservation.end_time);
  const toDateInputValue = date => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  };

  showModal('Actualizar reserva', `
    <form id="edit-reservation-form">
      <div class="form-group">
        <label class="form-label" for="edit-date">Día</label>
        <input id="edit-date" class="form-input" type="date" value="${toDateInputValue(start)}" required>
      </div>
      <div class="form-group">
        <label class="form-label" for="edit-hour">Hora de inicio</label>
        <select id="edit-hour" class="form-input" required>
          ${Array.from({ length: 13 }, (_, index) => {
            const hour = index + 8;
            const label = hour < 12 ? `${hour}:00 a. m.` : `${hour === 12 ? 12 : hour - 12}:00 p. m.`;
            return `<option value="${hour}" ${hour === start.getHours() ? 'selected' : ''}>${label}</option>`;
          }).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="edit-duration">Duración</label>
        <select id="edit-duration" class="form-input" required>
          ${[1, 2, 3].map(hours => `<option value="${hours}" ${hours === Math.round((end - start) / 3600000) ? 'selected' : ''}>${hours} ${hours === 1 ? 'hora' : 'horas'}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="edit-notes">Notas</label>
        <textarea id="edit-notes" class="form-input" rows="3">${escapeHtml(reservation.notes || '')}</textarea>
      </div>
      <button type="submit" class="btn btn--primary btn--block">Guardar cambios</button>
    </form>
  `);

  document.getElementById('edit-reservation-form').addEventListener('submit', async event => {
    event.preventDefault();
    const date = document.getElementById('edit-date').value;
    const startHour = Number(document.getElementById('edit-hour').value);
    const duration = Number(document.getElementById('edit-duration').value);
    const startTime = new Date(`${date}T${String(startHour).padStart(2, '0')}:00:00`);
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + duration);
    const notes = document.getElementById('edit-notes').value.trim();

    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || endTime <= startTime) {
      showToast('El horario seleccionado no es válido', 'warning');
      return;
    }

    setLoading(true);
    try {
      const { data: overlaps, error: overlapError } = await supabase
        .from('reservations')
        .select('id')
        .eq('space_id', reservation.space_id)
        .neq('id', reservation.id)
        .in('status', ['pendiente', 'aprobada'])
        .lt('start_time', endTime.toISOString())
        .gt('end_time', startTime.toISOString());

      if (overlapError) throw overlapError;
      if (overlaps?.length) {
        showToast('Ese horario ya está ocupado', 'error');
        return;
      }

      const user = await getCurrentUser();
      if (!user) {
        showToast('Tu sesión expiró. Inicia sesión nuevamente.', 'warning');
        return;
      }

      const { error } = await supabase
        .from('reservations')
        .update({ start_time: startTime.toISOString(), end_time: endTime.toISOString(), notes })
        .eq('id', reservation.id)
        .eq('user_id', user.id)
        .eq('status', 'pendiente');

      if (error) throw error;

      document.querySelector('.modal-close')?.click();
      showToast('Reserva actualizada', 'success');
      await loadReservations();
    } catch (error) {
      showReservationError(error, 'actualizar');
      console.error(error);
    } finally {
      setLoading(false);
    }
  });
}

function showReservationError(error, action) {
  const code = error?.code ? ` (${error.code})` : '';
  const message = error?.message || `No se pudo ${action} la reserva`;
  const hint = error?.code === '42501'
    ? ' Ejecuta fix-reservation-policies.sql en Supabase.'
    : '';
  showToast(`${message}${code}${hint}`, 'error', 3000);
}
