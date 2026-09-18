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
  realtimeChannel = supabase
    .channel('admin-reservations-updates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, payload => {
      loadReservations();
    })
    .subscribe();

  window.addEventListener('hashchange', () => {
    if (!window.location.hash.includes('admin-reservations')) {
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    }
  }, { once: true });
}

async function loadReservations() {
  setLoading(true);
  try {
    const typeFilter = document.getElementById('filter-type').value;
    const statusFilter = document.getElementById('filter-status').value;

    let query = supabase
      .from('reservations')
      .select('*, spaces(name, type), profiles:user_id(full_name, phone)')
      .order('start_time', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) throw error;

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
      const userName = res.profiles ? res.profiles.full_name : 'N/A';
      const userPhone = res.profiles ? res.profiles.phone : 'N/A';
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
    showToast('Error al cargar reservas', 'error');
    console.error(error);
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
