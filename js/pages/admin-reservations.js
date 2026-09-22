import { supabase } from '../supabase.js';
import { isAdmin } from '../auth.js';
import { showToast, showConfirm, setLoading, formatDate, renderBadge, escapeHtml } from '../ui.js';

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
    </div>
  `;
}

export async function init() {
  const user = await (await import('../auth.js')).getCurrentUser();
  if (!isAdmin(user)) return;

  document.getElementById('filter-type').addEventListener('change', loadReservations);
  document.getElementById('filter-status').addEventListener('change', loadReservations);
  document.getElementById('btn-refresh').addEventListener('click', loadReservations);

  await loadReservations();

  // Setup Realtime
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
  }

  realtimeChannel = supabase
    .channel('admin-reservations-updates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
      loadReservations();
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

function bindTableActions() {
  const buttons = document.querySelectorAll('#admin-reservations-table button');
  buttons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const action = e.target.dataset.action;
      const id = e.target.dataset.id;
      
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
            loadReservations();
          }
        });
      } else if (action === 'delete') {
        showConfirm('¿Estás seguro de eliminar esta reserva por completo?', async () => {
          setLoading(true);
          const { error } = await supabase
            .from('reservations')
            .delete()
            .eq('id', id);
          setLoading(false);
          if (error) {
            showToast('Error al eliminar', 'error');
          } else {
            showToast('Reserva eliminada', 'success');
            loadReservations();
          }
        });
      }
    });
  });
}
