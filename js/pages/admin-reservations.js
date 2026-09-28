import { supabase } from '../supabase.js';
import { isAdmin } from '../auth.js';
import { showToast, showConfirm, setLoading, formatDate, renderBadge, escapeHtml, getLocalDateRange, getLocalDateString } from '../ui.js';

let realtimeChannel = null;

export async function render() {
  return `
    <div class="page-container">
      <h2 class="page-title">Gestión de Reservas</h2>
      
      <div class="admin-filters">
        <select id="filter-type" class="form-input">
          <option value="all">Todos los tipos</option>
          <option value="futbol">Fútbol</option>
          <option value="motocross">Motocross</option>
          <option value="billar">Billar</option>
        </select>
        <select id="filter-status" class="form-input">
          <option value="all">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="aprobada">Aprobada</option>
          <option value="completada">Completada</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <button id="btn-refresh" class="btn btn--secondary">Refrescar</button>
      </div>

      <div class="table-responsive">
        <table class="table" id="admin-reservations-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Espacio</th>
              <th>Usuario / Tel</th>
              <th>Fecha y Hora</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <!-- Data injected here -->
          </tbody>
        </table>
      </div>

      <section class="reservation-history">
        <h3>Historial de reservas</h3>
        <div class="admin-filters">
          <div class="form-group">
            <label class="form-label" for="history-date">Fecha</label>
            <input id="history-date" class="form-input w-auto" type="date" value="${getLocalDateString()}">
          </div>
          <button id="btn-search-history" class="btn btn--primary">Buscar</button>
          <button id="btn-clear-history" class="btn btn--secondary">Limpiar</button>
        </div>
        <div class="table-responsive">
          <table class="table" id="admin-reservation-history-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Espacio</th>
                <th>Usuario / Tel</th>
                <th>Fecha y Hora</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colspan="6" class="text-center">Selecciona una fecha para consultar el historial</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

export async function init() {
  const user = await (await import('../auth.js')).getCurrentUser();
  if (!isAdmin(user)) return;

  document.getElementById('filter-type').addEventListener('change', loadReservations);
  document.getElementById('filter-status').addEventListener('change', loadReservations);
  document.getElementById('btn-refresh').addEventListener('click', loadReservations);
  document.getElementById('btn-search-history').addEventListener('click', () => {
    if (!document.getElementById('history-date').value) {
      showToast('Selecciona una fecha para buscar', 'warning');
      return;
    }
    loadReservationHistory();
  });
  document.getElementById('btn-clear-history').addEventListener('click', () => {
    document.getElementById('history-date').value = '';
    document.querySelector('#admin-reservation-history-table tbody').innerHTML =
      '<tr><td colspan="6" class="text-center">Selecciona una fecha para consultar el historial</td></tr>';
  });

  await loadReservations();
  await loadReservationHistory();

  // Setup Realtime
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
  }

  realtimeChannel = supabase
    .channel('admin-reservations-updates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
      refreshReservationTables();
    })
    .subscribe();

  const cleanupRealtime = () => {
    if (window.location.hash.includes('admin/reservas')) return;
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
  };

  window.addEventListener('hashchange', cleanupRealtime, { passive: true });
}

async function refreshReservationTables() {
  await loadReservations();
  await loadReservationHistory();
}

async function loadReservations() {
  setLoading(true);
  try {
    const typeFilter = document.getElementById('filter-type').value;
    const statusFilter = document.getElementById('filter-status').value;

    let query = supabase
      .from('reservations')
      .select('*, spaces(name, type)')
      .order('start_time', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) throw error;

    const userIds = [...new Set((data || []).map(r => r.user_id).filter(Boolean))];
    const profileMap = {};

    if (userIds.length) {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      (profilesData || []).forEach(profile => {
        profileMap[profile.id] = profile;
      });
    }

    const tbody = document.querySelector('#admin-reservations-table tbody');

    let filteredData = data;
    if (typeFilter !== 'all') {
      filteredData = data.filter(r => r.spaces && r.spaces.type === typeFilter);
    }

    if (!filteredData || filteredData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No se encontraron reservas</td></tr>';
      return;
    }

    let html = '';
    filteredData.forEach(res => {
      const spaceName = res.spaces ? res.spaces.name : 'N/A';
      const spaceType = res.spaces ? res.spaces.type : 'N/A';
      const profile = profileMap[res.user_id] || {};
      const userName = profile.full_name || 'N/A';
      const userPhone = profile.phone || 'N/A';
      const timeStr = `${formatDate(new Date(res.start_time))} - ${new Date(res.end_time).getHours()}:00`;

      let actionsHtml = '';
      if (res.status === 'pendiente') {
        actionsHtml += `<button class="btn btn--sm btn--success" data-action="update-status" data-status="aprobada" data-id="${res.id}">Aprobar</button> `;
        actionsHtml += `<button class="btn btn--sm btn--danger" data-action="update-status" data-status="rechazada" data-id="${res.id}">Rechazar</button> `;
      } else if (res.status === 'aprobada') {
        actionsHtml += `<button class="btn btn--sm btn--primary" data-action="update-status" data-status="completada" data-id="${res.id}">Completar</button> `;
        actionsHtml += `<button class="btn btn--sm btn--warning" data-action="update-status" data-status="cancelada" data-id="${res.id}">Cancelar</button> `;
      }
      actionsHtml += `<button class="btn btn--sm btn--danger" data-action="delete" data-id="${res.id}">Eliminar</button>`;

      html += `
        <tr>
          <td>${String(res.id).substring(0, 6)}</td>
          <td>${escapeHtml(spaceName)} <small>(${escapeHtml(spaceType)})</small></td>
          <td>${escapeHtml(userName)} <br><small>${escapeHtml(userPhone)}</small></td>
          <td>${timeStr}</td>
          <td>${renderBadge(res.status)}</td>
          <td class="action-cell">${actionsHtml}</td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
    bindTableActions();

  } catch (error) {
    const message = error?.message || 'No se pudo cargar la lista de reservas.';
    showToast(`Error al cargar reservas: ${message}`, 'error');
    console.error('Error al cargar reservas:', error);
  } finally {
    setLoading(false);
  }
}

async function loadReservationHistory() {
  const date = document.getElementById('history-date').value;
  const tbody = document.querySelector('#admin-reservation-history-table tbody');
  if (!date) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Selecciona una fecha para consultar el historial</td></tr>';
    return;
  }

  const { start, end } = getLocalDateRange(date);
  setLoading(true);
  try {
    const [reservationsResult, archivedResult] = await Promise.all([
      supabase
        .from('reservations')
        .select('id, user_id, start_time, end_time, status, spaces(name, type)')
        .gte('start_time', start)
        .lte('start_time', end),
      supabase
        .from('reservation_history')
        .select('id, start_time, end_time, status, space_name, space_type, user_name, user_phone, archived_at')
        .gte('start_time', start)
        .lte('start_time', end)
    ]);

    if (reservationsResult.error) throw reservationsResult.error;
    if (archivedResult.error) throw archivedResult.error;

    const reservations = reservationsResult.data || [];
    const archivedReservations = archivedResult.data || [];
    const userIds = [...new Set(reservations.map(reservation => reservation.user_id).filter(Boolean))];
    const profileMap = {};
    if (userIds.length) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .in('id', userIds);
      if (profilesError) throw profilesError;
      (profiles || []).forEach(profile => {
        profileMap[profile.id] = profile;
      });
    }

    const history = [
      ...reservations.map(reservation => {
        const profile = profileMap[reservation.user_id] || {};
        return {
          id: reservation.id,
          start_time: reservation.start_time,
          end_time: reservation.end_time,
          status: reservation.status,
          space_name: reservation.spaces?.name || 'N/A',
          space_type: reservation.spaces?.type || 'N/A',
          user_name: profile.full_name || 'N/A',
          user_phone: profile.phone || 'N/A',
          archived_at: null
        };
      }),
      ...archivedReservations
    ].sort((first, second) => new Date(second.start_time) - new Date(first.start_time));

    if (history.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay reservas en esta fecha</td></tr>';
      return;
    }

    tbody.innerHTML = history.map(reservation => {
      const timeStr = `${formatDate(reservation.start_time)} - ${new Date(reservation.end_time).getHours()}:00`;
      return `
        <tr>
          <td>${String(reservation.id).substring(0, 6)}</td>
          <td>${escapeHtml(reservation.space_name)} <small>(${escapeHtml(reservation.space_type)})</small></td>
          <td>${escapeHtml(reservation.user_name)} <br><small>${escapeHtml(reservation.user_phone)}</small></td>
          <td>${timeStr}</td>
          <td>${renderBadge(reservation.status)}${reservation.archived_at ? ' <small>Archivada</small>' : ''}</td>
          <td><button type="button" class="btn btn--sm btn--danger" data-action="delete-history" data-source="${reservation.archived_at ? 'history' : 'reservation'}" data-id="${reservation.id}">Eliminar</button></td>
        </tr>
      `;
    }).join('');
    bindHistoryActions();
  } catch (error) {
    const message = error?.message || 'No se pudo cargar el historial.';
    showToast(`Error al cargar historial: ${message}`, 'error');
    console.error('Error al cargar historial:', error);
  } finally {
    setLoading(false);
  }
}

function bindHistoryActions() {
  document.querySelectorAll('#admin-reservation-history-table [data-action="delete-history"]').forEach(button => {
    button.addEventListener('click', event => {
      const id = Number(event.currentTarget.dataset.id);
      const source = event.currentTarget.dataset.source;
      const isArchived = source === 'history';
      showConfirm(
        isArchived ? '¿Eliminar esta reserva del historial?' : '¿Eliminar esta reserva?',
        isArchived
          ? 'La reserva se quitará únicamente del historial.'
          : 'La reserva se eliminará de Aprobación y del historial.',
        async () => {
          let deleted = false;
          let deleteError = null;
          setLoading(true);
          try {
            if (isArchived) {
              const result = await supabase.rpc('delete_reservation_history_entry', { p_reservation_id: id });
              deleted = result.data;
              deleteError = result.error;
            } else {
              const result = await supabase.from('reservations').delete().eq('id', id);
              deleted = !result.error;
              deleteError = result.error;
            }
          } catch (error) {
            deleteError = error;
          } finally {
            setLoading(false);
          }

          if (deleteError) {
            console.error('No se pudo eliminar la reserva:', deleteError);
            showToast(`No se pudo eliminar la reserva: ${deleteError.message}`, 'error', 6000);
          } else if (!deleted) {
            showToast('La reserva ya no existe', 'warning');
          } else {
            showToast('Reserva eliminada', 'success');
            if (isArchived) {
              await loadReservationHistory();
            } else {
              await refreshReservationTables();
            }
          }
        }
      );
    });
  });
}

function bindTableActions() {
  const buttons = document.querySelectorAll('#admin-reservations-table button');
  buttons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const action = e.currentTarget.dataset.action;
      const id = e.currentTarget.dataset.id;
      
      if (action === 'update-status') {
        const newStatus = e.target.dataset.status;
        showConfirm(`¿Confirmas el cambio de estado a ${newStatus}?`, async () => {
          setLoading(true);
          const { error } = await supabase
            .from('reservations')
            .update({ status: newStatus })
            .eq('id', id);
          setLoading(false);
          if (error) {
            showToast('Error al actualizar estado', 'error');
          } else {
            showToast('Estado actualizado', 'success');
            await refreshReservationTables();
          }
        });
      } else if (action === 'delete') {
        showConfirm('¿Eliminar esta reserva?', 'La reserva se quitará de la gestión y se conservará en el historial.', async () => {
          setLoading(true);
          const { data: deleted, error } = await supabase
            .rpc('archive_and_delete_reservation', { p_reservation_id: Number(id) });
          setLoading(false);
          if (error) {
            console.error('No se pudo guardar la reserva en el historial:', error);
            showToast(`No se pudo guardar en el historial: ${error.message}`, 'error', 6000);
          } else if (!deleted) {
            showToast('La reserva ya no existe', 'error');
          } else {
            showToast('Reserva eliminada de la gestión y conservada en el historial', 'success');
            await refreshReservationTables();
          }
        });
      }
    });
  });
}
