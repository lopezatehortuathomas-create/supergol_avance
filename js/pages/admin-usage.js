import { supabase } from '../supabase.js';
import { getCurrentUser, isAdmin } from '../auth.js';
import { showToast, showModal, showConfirm, setLoading, formatDate, formatCurrency, renderBadge, escapeHtml, closeModal } from '../ui.js';
import { navigateTo } from '../router.js';

let spaces = [];
let todayReservations = [];

const USAGE_TIME_START = 8;
const USAGE_TIME_END = 20;

function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function applyUsageDateBounds() {
    const field = document.getElementById('usage-time');
    if (!field) return;

    field.min = `${String(USAGE_TIME_START).padStart(2, '0')}:00`;
    field.max = `${String(USAGE_TIME_END).padStart(2, '0')}:00`;
    field.placeholder = 'Hora de uso';
}

function validateUsageTime(value) {
    if (!value) return false;

    const [hours, minutes] = value.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return false;

    const totalMinutes = hours * 60 + minutes;
    const startMinutes = USAGE_TIME_START * 60;
    const endMinutes = USAGE_TIME_END * 60;

    return totalMinutes >= startMinutes && totalMinutes <= endMinutes;
}

export function render() {
    return `
        <div class="page-container">
            <header class="page-header">
                <h2>Registro de Usos</h2>
            </header>

            <div class="grid grid-cols-1 xl:grid-cols-[minmax(260px,0.9fr)_minmax(0,2.1fr)] gap-4">
                <div>
                    <div class="card h-full">
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
                                    <label class="form-label" for="usage-name">Nombre</label>
                                    <input type="text" id="usage-name" class="form-input" placeholder="Nombre completo" required>
                                </div>
                                <div class="form-group">
                                    <label class="form-label" for="usage-phone">Celular</label>
                                    <input type="tel" id="usage-phone" class="form-input" placeholder="Número de contacto" required>
                                </div>
                                <div class="form-group">
                                    <label class="form-label" for="usage-duration">Duración (minutos)</label>
                                    <input type="number" id="usage-duration" class="form-input" min="1" required>
                                </div>
                                <div class="form-group">
                                    <label class="form-label" for="usage-date">Fecha de uso</label>
                                    <input type="date" id="usage-date" class="form-input" readonly required>
                                </div>
                                <div class="form-group">
                                    <label class="form-label" for="usage-time">Hora de uso</label>
                                    <input type="time" id="usage-time" class="form-input" min="08:00" max="20:00" step="60" value="08:00" required>
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
                <div>
                    <div class="card h-full">
                        <div class="card__header flex flex-col gap-3 md:flex-row md:justify-between md:items-center">
                            <h3>Historial de Usos</h3>
                            <div class="flex flex-wrap gap-2">
                                <select id="filter-space" class="form-input w-auto">
                                    <option value="">Todos los espacios</option>
                                </select>
                                <input type="date" id="filter-date" class="form-input w-auto">
                                <button id="btn-filter" class="btn btn--sm btn--primary">Buscar</button>
                            </div>
                        </div>
                        <div class="card__body">
                            <div class="table-responsive">
                                <table class="table" id="usage-table">
                                    <thead>
                                        <tr>
                                            <th>Fecha</th>
                                            <th>Nombre</th>
                                            <th>Celular</th>
                                            <th>Espacio</th>
                                            <th>Duración</th>
                                            <th>Notas</th>
                                            <th>Registrado por</th>
                                            <th>Acciones</th>
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

            <div class="stats-grid mt-4">
                <div class="stat-card">
                    <h3 class="stat-title">Uso por zona hoy</h3>
                    <div class="stat-list" id="stats-today"></div>
                </div>
                <div class="stat-card">
                    <h3 class="stat-title">Uso por zona esta semana</h3>
                    <div class="stat-list" id="stats-week"></div>
                </div>
                <div class="stat-card">
                    <h3 class="stat-title">Uso por zona este mes</h3>
                    <div class="stat-list" id="stats-month"></div>
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

        const today = getLocalDateString();
        document.getElementById('filter-date').value = today;
        const usageDateField = document.getElementById('usage-date');
        const usageTimeField = document.getElementById('usage-time');
        usageDateField.value = today;
        usageTimeField.value = '08:00';
        applyUsageDateBounds();

        await loadSpaces();
        await loadStats();
        await loadUsageHistory();

        usageTimeField.addEventListener('change', () => {
            const selectedValue = usageTimeField.value;
            if (!selectedValue) return;

            if (!validateUsageTime(selectedValue)) {
                usageTimeField.value = '08:00';
                showToast('Selecciona una hora entre las 08:00 y 20:00', 'warning');
            }
        });

        document.getElementById('usage-form').addEventListener('submit', handleUsageSubmit);
        document.getElementById('btn-filter').addEventListener('click', loadUsageHistory);
        document.getElementById('filter-space').addEventListener('change', loadUsageHistory);
        document.getElementById('filter-date').addEventListener('change', loadUsageHistory);
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

async function handleUsageSubmit(e) {
    e.preventDefault();
    
    const spaceId = document.getElementById('usage-space').value;
    const customerName = document.getElementById('usage-name').value.trim();
    const customerPhone = document.getElementById('usage-phone').value.trim();
    const duration = parseInt(document.getElementById('usage-duration').value, 10);
    const usageDateValue = document.getElementById('usage-date').value;
    const usageTimeValue = document.getElementById('usage-time').value;

    if (!usageDateValue || !usageTimeValue) {
        showToast('Selecciona la fecha y la hora de uso', 'error');
        return;
    }

    if (!validateUsageTime(usageTimeValue)) {
        showToast('La hora debe estar entre las 08:00 y 20:00', 'error');
        return;
    }

    const usedAt = new Date(`${usageDateValue}T${usageTimeValue}:00`).toISOString();
    const notes = document.getElementById('usage-notes').value;

    try {
        setLoading(true);
        const user = await getCurrentUser();
        
        const { error } = await supabase.from('usage_logs').insert([{
            space_id: spaceId,
            duration_min: duration,
            notes: notes,
            used_at: usedAt,
            customer_name: customerName,
            customer_phone: customerPhone,
            registered_by: user.id
        }]);

        if (error) throw error;
        
        showToast('Uso registrado exitosamente', 'success');
        document.getElementById('usage-form').reset();
        const usageDateField = document.getElementById('usage-date');
        const usageTimeField = document.getElementById('usage-time');
        usageDateField.value = getLocalDateString();
        usageTimeField.value = '08:00';
        applyUsageDateBounds();
        await Promise.all([loadUsageHistory(), loadStats()]);
    } catch (error) {
        console.error('Error registering usage:', error);
        showToast('Error al registrar el uso', 'error');
    } finally {
        setLoading(false);
    }
}

function getDateOnlyValue(dateValue) {
    if (!dateValue) return '';
    return dateValue.split('T')[0] || dateValue;
}

function getLocalDatePart(dateValue) {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function loadUsageHistory() {
    try {
        const spaceId = document.getElementById('filter-space')?.value || '';
        const filterDate = getDateOnlyValue(document.getElementById('filter-date')?.value || '');

        const [usageResult, reservationsResult, spacesResult] = await Promise.all([
            supabase
                .from('usage_logs')
                .select('id, used_at, customer_name, customer_phone, duration_min, notes, space_id, registered_by')
                .order('used_at', { ascending: false }),
            supabase
                .from('reservations')
                .select('id, space_id, start_time, end_time, user_id, status, notes')
                .eq('status', 'completada')
                .order('end_time', { ascending: false }),
            supabase
                .from('spaces')
                .select('id, name')
        ]);

        if (usageResult.error) throw usageResult.error;
        if (reservationsResult.error) throw reservationsResult.error;
        if (spacesResult.error) throw spacesResult.error;

        const spaceMap = Object.fromEntries((spacesResult.data || []).map(space => [String(space.id), space.name]));

        const tableBody = document.getElementById('usage-table-body');
        const emptyState = document.getElementById('usage-empty-state');
        const table = document.getElementById('usage-table');

        tableBody.innerHTML = '';
        table.classList.add('hidden');
        emptyState.classList.add('hidden');

        const manualRecords = (usageResult.data || []).map(log => ({
            ...log,
            source: 'manual',
            space_name: spaceMap[String(log.space_id)] || 'N/A',
            date: log.used_at,
            rowType: 'Uso manual'
        }));

        const completedReservations = (reservationsResult.data || []).map(reservation => ({
            id: reservation.id,
            source: 'reservation',
            customer_name: 'Reserva completada',
            customer_phone: '—',
            duration_min: Math.max(0, Math.round((new Date(reservation.end_time) - new Date(reservation.start_time)) / 60000)),
            notes: reservation.notes || 'Reserva completada',
            space_id: reservation.space_id,
            space_name: spaceMap[String(reservation.space_id)] || 'N/A',
            registered_by: reservation.user_id ? reservation.user_id.slice(0, 8) : 'Sistema',
            date: reservation.end_time,
            rowType: 'Reserva completada'
        }));

        const allRecords = [...manualRecords, ...completedReservations]
            .filter(record => {
                const matchesSpace = !spaceId || Number(record.space_id) === Number(spaceId);
                const matchesDate = !filterDate || getLocalDatePart(record.date) === filterDate;
                return matchesSpace && matchesDate;
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        if (!allRecords.length) {
            emptyState.classList.remove('hidden');
            return;
        }

        table.classList.remove('hidden');
        emptyState.classList.add('hidden');

        tableBody.innerHTML = allRecords.map(record => `
            <tr>
                <td>${formatDate(record.date)}</td>
                <td>${escapeHtml(record.customer_name || 'Sin nombre')}</td>
                <td>${escapeHtml(record.customer_phone || 'Sin celular')}</td>
                <td>${escapeHtml(record.space_name)}</td>
                <td>${record.duration_min || 0} min</td>
                <td>${escapeHtml(record.notes || '-')}</td>
                <td>${escapeHtml(record.registered_by ? record.registered_by.slice(0, 8) : 'Sistema')}</td>
                <td>
                    ${record.source === 'manual' ? `<button class="btn btn--sm btn--secondary" data-delete-id="${record.id}">Eliminar</button>` : `<span class="badge badge--completada">${escapeHtml(record.rowType)}</span>`}
                </td>
            </tr>
        `).join('');

        tableBody.querySelectorAll('[data-delete-id]').forEach(button => {
            button.addEventListener('click', async () => {
                const id = Number(button.dataset.deleteId);
                const row = button.closest('tr');

                const confirmed = await showConfirm('Eliminar registro', '¿Seguro que quieres eliminar este uso?', async () => {
                    try {
                        const { error: deleteError } = await supabase.from('usage_logs').delete().eq('id', id);
                        if (deleteError) throw deleteError;

                        if (row) row.remove();

                        const remainingRows = tableBody.querySelectorAll('tr').length;
                        if (remainingRows === 0) {
                            table.classList.add('hidden');
                            emptyState.classList.remove('hidden');
                        }

                        await Promise.all([loadUsageHistory(), loadStats()]);
                        showToast('Registro eliminado', 'success');
                    } catch (error) {
                        console.error('Error deleting usage:', error);
                        showToast('Error al eliminar el uso', 'error');
                    }
                });
                if (!confirmed) return;
            });
        });

        tableBody.querySelectorAll('[data-delete-id]').forEach(button => {
            button.addEventListener('click', async () => {
                const id = Number(button.dataset.deleteId);
                const row = button.closest('tr');

                const confirmed = await showConfirm('Eliminar registro', '¿Seguro que quieres eliminar este uso?', async () => {
                    try {
                        const { error: deleteError } = await supabase.from('usage_logs').delete().eq('id', id);
                        if (deleteError) throw deleteError;

                        if (row) row.remove();

                        const remainingRows = tableBody.querySelectorAll('tr').length;
                        if (remainingRows === 0) {
                            table.classList.add('hidden');
                            emptyState.classList.remove('hidden');
                        }

                        await Promise.all([loadUsageHistory(), loadStats()]);
                        showToast('Registro eliminado', 'success');
                    } catch (error) {
                        console.error('Error deleting usage:', error);
                        showToast('Error al eliminar el uso', 'error');
                    }
                });
                if (!confirmed) return;
            });
        });

    } catch (error) {
        console.error('Error loading usage history:', error);
        showToast('Error al cargar historial', 'error');
    }
}

async function loadStats() {
    try {
        const now = new Date();

        const buildPeriod = (key) => {
            if (key === 'today') {
                const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
                return { start, end };
            }
            if (key === 'week') {
                const start = new Date(now);
                start.setDate(now.getDate() - now.getDay());
                start.setHours(0, 0, 0, 0);
                const end = new Date(start);
                end.setDate(start.getDate() + 6);
                end.setHours(23, 59, 59, 999);
                return { start, end };
            }
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            return { start, end };
        };

        const spaceTypes = {
            futbol: 'Cancha de Fútbol',
            motocross: 'Pista de Motocross',
            billar: 'Mesa de Billar'
        };

        const [usageResult, reservationsResult, spacesResult] = await Promise.all([
            supabase.from('usage_logs').select('space_id, used_at'),
            supabase.from('reservations').select('space_id, end_time, status').eq('status', 'completada'),
            supabase.from('spaces').select('id, type')
        ]);

        if (usageResult.error) throw usageResult.error;
        if (reservationsResult.error) throw reservationsResult.error;
        if (spacesResult.error) throw spacesResult.error;

        const spaceTypeById = {};
        (spacesResult.data || []).forEach(space => {
            spaceTypeById[String(space.id)] = space.type;
        });

        const summary = {
            today: { futbol: 0, motocross: 0, billar: 0 },
            week: { futbol: 0, motocross: 0, billar: 0 },
            month: { futbol: 0, motocross: 0, billar: 0 }
        };

        const addValue = (period, type) => {
            if (!summary[period] || !type || !summary[period][type]) return;
            summary[period][type] += 1;
        };

        const countEvents = (events, dateField, periodKey) => {
            const period = buildPeriod(periodKey);
            for (const event of events) {
                const date = new Date(event[dateField]);
                if (Number.isNaN(date.getTime())) continue;
                const type = spaceTypeById[String(event.space_id)];
                if (!type || !spaceTypes[type]) continue;
                if (date >= period.start && date <= period.end) {
                    summary[periodKey][type] = (summary[periodKey][type] || 0) + 1;
                }
            }
        };

        countEvents(usageResult.data || [], 'used_at', 'today');
        countEvents(usageResult.data || [], 'used_at', 'week');
        countEvents(usageResult.data || [], 'used_at', 'month');
        countEvents(reservationsResult.data || [], 'end_time', 'today');
        countEvents(reservationsResult.data || [], 'end_time', 'week');
        countEvents(reservationsResult.data || [], 'end_time', 'month');

        const renderPeriod = (periodKey) => {
            const container = document.getElementById(`stats-${periodKey === 'today' ? 'today' : periodKey === 'week' ? 'week' : 'month'}`);
            if (!container) return;

            const rows = Object.entries(spaceTypes).map(([type, label]) => {
                const value = summary[periodKey][type] || 0;
                return `
                    <div class="stat-row">
                        <span>${label}</span>
                        <strong>${value}</strong>
                    </div>
                `;
            }).join('');

            container.innerHTML = rows;
        };

        renderPeriod('today');
        renderPeriod('week');
        renderPeriod('month');
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}
