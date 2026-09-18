import { supabase } from '../supabase.js';
import { getCurrentUser, isAdmin } from '../auth.js';
import { showToast, showModal, showConfirm, setLoading, formatDate, formatCurrency, renderBadge, escapeHtml, closeModal } from '../ui.js';
import { navigateTo } from '../router.js';

let spaces = [];
let todayReservations = [];

export function render() {
    return `
        <div class="page-container">
            <header class="page-header">
                <h2>Registro de Usos</h2>
            </header>

            <div class="stats-grid mb-4">
                <div class="stat-card">
                    <h3 class="stat-title">Total usos hoy</h3>
                    <div class="stat-value" id="stats-today">0</div>
                </div>
                <div class="stat-card">
                    <h3 class="stat-title">Total usos esta semana</h3>
                    <div class="stat-value" id="stats-week">0</div>
                </div>
                <div class="stat-card">
                    <h3 class="stat-title">Total usos este mes</h3>
                    <div class="stat-value" id="stats-month">0</div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="md:col-span-1">
                    <div class="card">
                        <div class="card__header">
                            <h3>Registrar Uso</h3>
                        </div>
                        <div class="card__body">
                            <form id="usage-form" class="usage-form">
                                <div class="form-group">
                                    <label class="form-label" for="usage-space">Espacio</label>
                                    <select id="usage-space" class="form-input" required>
                                        <option value="">Seleccione un espacio...</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label" for="usage-reservation">Reserva Asociada (Opcional)</label>
                                    <select id="usage-reservation" class="form-input">
                                        <option value="">Ninguna</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label" for="usage-duration">Duración (minutos)</label>
                                    <input type="number" id="usage-duration" class="form-input" min="1" required>
                                </div>
                                <div class="form-group">
                                    <label class="form-label" for="usage-notes">Notas (Opcional)</label>
                                    <textarea id="usage-notes" class="form-input" rows="3"></textarea>
                                </div>
                                <button type="submit" class="btn btn--primary w-full">Registrar Uso</button>
                            </form>
                        </div>
                    </div>
                </div>
                <div class="md:col-span-2">
                    <div class="card">
                        <div class="card__header flex justify-between items-center">
                            <h3>Historial de Usos</h3>
                            <div class="flex gap-2">
                                <select id="filter-space" class="form-input w-auto">
                                    <option value="">Todos los espacios</option>
                                </select>
                                <input type="date" id="filter-start-date" class="form-input w-auto">
                                <input type="date" id="filter-end-date" class="form-input w-auto">
                                <button id="btn-filter" class="btn btn--sm btn--primary">Filtrar</button>
                            </div>
                        </div>
                        <div class="card__body">
                            <div class="table-responsive">
                                <table class="table" id="usage-table">
                                    <thead>
                                        <tr>
                                            <th>Fecha</th>
                                            <th>Espacio</th>
                                            <th>Duración</th>
                                            <th>Reserva Asociada</th>
                                            <th>Notas</th>
                                            <th>Registrado por</th>
                                        </tr>
                                    </thead>
                                    <tbody id="usage-table-body">
                                        <!-- Usages will be loaded here -->
                                    </tbody>
                                </table>
                            </div>
                            <div id="usage-empty-state" class="empty-state hidden">
                                <p>No hay registros de uso para mostrar.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

export async function init() {
    try {
        const user = await getCurrentUser();
        if (!user || !isAdmin(user)) {
            navigateTo('#/');
            return;
        }

        // Initialize date filters to today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('filter-start-date').value = today;
        document.getElementById('filter-end-date').value = today;

        await loadSpaces();
        await loadReservations();
        await loadStats();
        await loadUsageHistory();

        document.getElementById('usage-form').addEventListener('submit', handleUsageSubmit);
        document.getElementById('usage-space').addEventListener('change', updateReservationsDropdown);
        document.getElementById('btn-filter').addEventListener('click', loadUsageHistory);
    } catch (error) {
        console.error('Error in admin-usage init:', error);
        showToast('Error al inicializar la página', 'error');
    }
}

async function loadSpaces() {
    try {
        const { data, error } = await supabase.from('spaces').select('*').order('name');
        if (error) throw error;
        spaces = data;

        const spaceSelect = document.getElementById('usage-space');
        const filterSpace = document.getElementById('filter-space');
        
        const options = spaces.map(space => `<option value="${space.id}">${escapeHtml(space.name)}</option>`).join('');
        
        spaceSelect.innerHTML = '<option value="">Seleccione un espacio...</option>' + options;
        filterSpace.innerHTML = '<option value="">Todos los espacios</option>' + options;
    } catch (error) {
        console.error('Error loading spaces:', error);
        showToast('Error al cargar espacios', 'error');
    }
}

async function loadReservations() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('reservations')
            .select('id, space_id, start_time, end_time, status')
            .gte('start_time', today + 'T00:00:00Z')
            .lte('start_time', today + 'T23:59:59Z')
            .eq('status', 'aprobada');

        if (error) throw error;
        todayReservations = data;
    } catch (error) {
        console.error('Error loading reservations:', error);
    }
}

function updateReservationsDropdown() {
    const spaceId = document.getElementById('usage-space').value;
    const reservationSelect = document.getElementById('usage-reservation');
    
    if (!spaceId) {
        reservationSelect.innerHTML = '<option value="">Ninguna</option>';
        return;
    }

    const spaceReservations = todayReservations.filter(r => r.space_id === spaceId);
    let options = '<option value="">Ninguna</option>';
    
    spaceReservations.forEach(r => {
        const time = new Date(r.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        options += `<option value="${r.id}">Hoy ${time}</option>`;
    });
    
    reservationSelect.innerHTML = options;
}

async function handleUsageSubmit(e) {
    e.preventDefault();
    
    const spaceId = document.getElementById('usage-space').value;
    const reservationId = document.getElementById('usage-reservation').value || null;
    const duration = parseInt(document.getElementById('usage-duration').value, 10);
    const notes = document.getElementById('usage-notes').value;

    try {
        setLoading(true);
        const user = await getCurrentUser();
        
        const { error } = await supabase.from('usage_logs').insert([{
            space_id: spaceId,
            reservation_id: reservationId,
            duration_min: duration,
            notes: notes,
            registered_by: user.id
        }]);

        if (error) throw error;
        
        showToast('Uso registrado exitosamente', 'success');
        document.getElementById('usage-form').reset();
        await Promise.all([loadUsageHistory(), loadStats()]);
    } catch (error) {
        console.error('Error registering usage:', error);
        showToast('Error al registrar el uso', 'error');
    } finally {
        setLoading(false);
    }
}

async function loadUsageHistory() {
    try {
        const spaceId = document.getElementById('filter-space').value;
        const startDate = document.getElementById('filter-start-date').value;
        const endDate = document.getElementById('filter-end-date').value;

        let query = supabase
            .from('usage_logs')
            .select('*, spaces(name), reservations(id, start_time), profiles:registered_by(full_name)')
            .order('used_at', { ascending: false });

        if (spaceId) {
            query = query.eq('space_id', spaceId);
        }
        if (startDate) {
            query = query.gte('used_at', startDate + 'T00:00:00Z');
        }
        if (endDate) {
            query = query.lte('used_at', endDate + 'T23:59:59Z');
        }

        const { data, error } = await query;
        if (error) throw error;

        const tableBody = document.getElementById('usage-table-body');
        const emptyState = document.getElementById('usage-empty-state');
        const table = document.getElementById('usage-table');

        if (data.length === 0) {
            table.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }

        table.classList.remove('hidden');
        emptyState.classList.add('hidden');

        tableBody.innerHTML = data.map(log => `
            <tr>
                <td>${formatDate(log.used_at)}</td>
                <td>${escapeHtml(log.spaces?.name || 'N/A')}</td>
                <td>${log.duration_min} min</td>
                <td>${log.reservations ? formatDate(log.reservations.start_time) : '-'}</td>
                <td>${escapeHtml(log.notes || '-')}</td>
                <td>${escapeHtml(log.profiles?.full_name || 'Sistema')}</td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error loading usage history:', error);
        showToast('Error al cargar historial', 'error');
    }
}

async function loadStats() {
    try {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay())).toISOString();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        // Need to run separate queries since Supabase doesn't support aggregate conditionally
        const [todayRes, weekRes, monthRes] = await Promise.all([
            supabase.from('usage_logs').select('id', { count: 'exact' }).gte('used_at', startOfDay),
            supabase.from('usage_logs').select('id', { count: 'exact' }).gte('used_at', startOfWeek),
            supabase.from('usage_logs').select('id', { count: 'exact' }).gte('used_at', startOfMonth)
        ]);

        document.getElementById('stats-today').textContent = todayRes.count || 0;
        document.getElementById('stats-week').textContent = weekRes.count || 0;
        document.getElementById('stats-month').textContent = monthRes.count || 0;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}
