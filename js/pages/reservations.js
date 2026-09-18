import { supabase } from '../supabase.js';
import { getCurrentUser } from '../auth.js';
import { showToast, setLoading } from '../ui.js';

let spaces = [];

export function render() {
  const hourOptions = Array.from({ length: 13 }, (_, index) => {
    const hour = index + 8;
    const label = hour < 12 ? `${hour}:00 a. m.` : `${hour === 12 ? 12 : hour - 12}:00 p. m.`;
    return `<option value="${hour}">${label}</option>`;
  }).join('');

  return `
    <div class="page-container reservation-page">
      <div class="reservation-intro">
        <p class="eyebrow">SUPERGOL · RESERVAS</p>
        <h2 class="page-title">Reserva tu espacio</h2>
        <p>Completa los datos y el equipo confirmará tu solicitud.</p>
      </div>

      <form id="reservation-form" class="reservation-form">
        <div class="reservation-form__header">
          <div class="reservation-form__number">01</div>
          <div>
            <p class="eyebrow">NUEVA RESERVA</p>
            <h3>Datos de la reserva</h3>
          </div>
        </div>

        <div class="reservation-form__grid">
          <div class="form-group reservation-form__wide">
            <label class="form-label" for="space-select">Espacio a reservar</label>
            <select id="space-select" class="form-input" required>
              <option value="">Cargando espacios...</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="reservation-date">Fecha</label>
            <input id="reservation-date" class="form-input" type="date" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="reservation-hour">Hora de inicio</label>
            <select id="reservation-hour" class="form-input" required>${hourOptions}</select>
          </div>
          <div class="form-group">
            <label class="form-label" for="reservation-duration">Duración</label>
            <select id="reservation-duration" class="form-input" required>
              <option value="1">1 hora</option>
              <option value="2">2 horas</option>
              <option value="3">3 horas</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="client-name">Nombre del cliente</label>
            <input id="client-name" class="form-input" type="text" placeholder="Nombre completo" autocomplete="name" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="client-phone">Teléfono del cliente</label>
            <input id="client-phone" class="form-input" type="tel" placeholder="300 000 0000" autocomplete="tel" required>
          </div>
        </div>

        <div class="reservation-form__footer">
          <div class="reservation-form__schedule"><span>HORARIO</span><strong>8:00 a. m. - 9:00 p. m.</strong></div>
          <button type="submit" class="btn btn--primary btn--lg">Confirmar reserva</button>
        </div>
      </form>
    </div>
  `;
}

export async function init() {
  const user = await getCurrentUser();
  if (!user) return;

  const dateInput = document.getElementById('reservation-date');
  const today = new Date();
  const todayValue = today.toISOString().split('T')[0];
  dateInput.min = todayValue;
  dateInput.value = todayValue;

  try {
    setLoading(true);
    const { data, error } = await supabase.from('spaces').select('*').eq('is_active', true).order('name');
    if (error) throw error;
    spaces = data || [];
    const select = document.getElementById('space-select');
    select.innerHTML = spaces.length
      ? spaces.map(space => `<option value="${space.id}">${space.name} · ${space.type}</option>`).join('')
      : '<option value="">No hay espacios disponibles</option>';
  } catch (error) {
    showToast('Error al cargar espacios', 'error');
    console.error(error);
  } finally {
    setLoading(false);
  }

  document.getElementById('reservation-form').addEventListener('submit', submitReservation);
}

async function submitReservation(event) {
  event.preventDefault();
  const user = await getCurrentUser();
  const spaceId = Number(document.getElementById('space-select').value);
  const date = document.getElementById('reservation-date').value;
  const startHour = Number(document.getElementById('reservation-hour').value);
  const duration = Number(document.getElementById('reservation-duration').value);
  const clientName = document.getElementById('client-name').value.trim();
  const clientPhone = document.getElementById('client-phone').value.trim();
  const startTime = new Date(`${date}T${String(startHour).padStart(2, '0')}:00:00`);
  const endTime = new Date(startTime);
  endTime.setHours(endTime.getHours() + duration);

  if (!spaceId || !date || endTime.getHours() > 21 || !clientName || !clientPhone) {
    showToast('Completa los datos dentro del horario de atención', 'warning');
    return;
  }

  setLoading(true);
  try {
    const { data: overlaps, error: overlapError } = await supabase
      .from('reservations')
      .select('id')
      .eq('space_id', spaceId)
      .in('status', ['pendiente', 'aprobada'])
      .lt('start_time', endTime.toISOString())
      .gt('end_time', startTime.toISOString());
    if (overlapError) throw overlapError;
    if (overlaps?.length) {
      showToast('Ese horario ya está ocupado', 'warning');
      return;
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ full_name: clientName, phone: clientPhone })
      .eq('id', user.id);
    if (profileError) throw profileError;

    const { error: insertError } = await supabase.from('reservations').insert([{
      user_id: user.id,
      space_id: spaceId,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      status: 'pendiente'
    }]);
    if (insertError) throw insertError;

    showToast('Reserva creada. Queda pendiente de aprobación.', 'success');
    event.target.reset();
    document.getElementById('reservation-date').value = new Date().toISOString().split('T')[0];
  } catch (error) {
    showToast('No se pudo crear la reserva', 'error');
    console.error(error);
  } finally {
    setLoading(false);
  }
}
