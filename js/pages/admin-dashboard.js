import { supabase } from '../supabase.js';
import { isAdmin } from '../auth.js';
import { showToast, setLoading, formatCurrency, renderBadge } from '../ui.js';
import { navigateTo } from '../router.js';

export async function render() {
  return `
    <div class="page-container admin-dashboard">
      <header class="dashboard-heading">
        <div>
          <p class="eyebrow">CENTRO DE OPERACIONES</p>
          <h2 class="page-title">Dashboard <span>- Samaca</span></h2>
        </div>
        <div class="dashboard-date">${new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
      </header>
      
      <div class="dashboard-grid">
        <div class="stat-card">
          <div class="stat-icon">$</div><h4>VENTAS HOY</h4>
          <p class="stat-note">Ingresos registrados</p>
          <div class="stat-value" id="stat-ventas-hoy">-</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">!</div><h4>PRODUCTOS EN STOCK CRÍTICO</h4>
          <p class="stat-note">Requieren atención</p>
          <div class="stat-value" id="stat-bajo-stock">-</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">▦</div><h4>RESERVAS HOY</h4>
          <p class="stat-note">Actividades programadas</p>
          <div class="stat-value" id="stat-res-hoy">-</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">◉</div><h4>USOS MESA BILLAR</h4>
          <p class="stat-note">Sesiones del día</p>
          <div class="stat-value" id="stat-res-pendientes">-</div>
        </div>
      </div>

      <div class="dashboard-panels">
        <section class="dashboard-list dashboard-list--wide">
          <div class="panel-heading"><h3>INVENTARIO EN ALERTA DE STOCK</h3><span></span></div>
          <ul id="recent-sales-list" class="item-list">Cargando...</ul>
          <button id="btn-nueva-venta" class="dashboard-cta">COMPRAR SUMINISTROS</button>
        </section>
        <section class="dashboard-list chart-panel">
          <div class="panel-heading"><h3>TOP PRODUCTOS MÁS VENDIDOS</h3><span></span></div>
          <div class="bar-chart" aria-label="Productos más vendidos"><i style="height: 86%"></i><i style="height: 65%"></i><i style="height: 48%"></i><i style="height: 38%"></i><i style="height: 25%"></i><i style="height: 16%"></i></div>
          <div class="chart-labels"><span>Cerveza</span><span>Gaseosa</span><span>Local</span><span>Sal</span><span>Mesa</span><span>Snack</span></div>
        </section>
        <section class="dashboard-list dashboard-list--wide">
          <div class="panel-heading"><h3>GESTIÓN DE RESERVAS Y ACTIVIDADES</h3><span></span></div>
          <ul id="recent-reservations-list" class="item-list">Cargando...</ul>
          <button id="btn-gestionar-reservas" class="dashboard-cta">VER RESERVAS</button>
        </section>
        <section class="dashboard-list chart-panel">
          <div class="panel-heading"><h3>USO DE MESAS DE BILLAR</h3><span></span></div>
          <div class="usage-chart"><i style="height: 24%"></i><i style="height: 32%"></i><i style="height: 47%"></i><i style="height: 82%"></i><i style="height: 100%"></i><i style="height: 65%"></i><i style="height: 52%"></i><i style="height: 35%"></i><i style="height: 24%"></i><i style="height: 48%"></i><i style="height: 72%"></i><i style="height: 38%"></i></div>
          <button id="btn-registrar-uso" class="chart-link">REGISTRAR USO →</button>
        </section>
      </div>
    </div>
  `;
}

export async function init() {
  const user = await (await import('../auth.js')).getCurrentUser();
  if (!isAdmin(user)) return;

  document.getElementById('btn-gestionar-reservas').addEventListener('click', () => navigateTo('#/admin/reservas'));
  document.getElementById('btn-registrar-uso').addEventListener('click', () => navigateTo('#/admin/usos'));
  document.getElementById('btn-nueva-venta').addEventListener('click', () => navigateTo('#/admin/inventario'));

  await loadStats();
  await loadRecentActivity();
}

async function loadStats() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Reservas hoy
    const { count: countHoy, error: err1 } = await supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .gte('start_time', today.toISOString())
      .lt('start_time', tomorrow.toISOString())
      .not('status', 'eq', 'cancelada');
    if (err1) throw err1;
    document.getElementById('stat-res-hoy').textContent = countHoy || 0;

    // Pendientes
    const { count: countPendientes, error: err2 } = await supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pendiente');
    if (err2) throw err2;
    document.getElementById('stat-res-pendientes').textContent = countPendientes || 0;

    // Bajo stock (min_stock not defined in schema directly, assuming stock < 10 for example, or schema has it)
    const { count: countStock, error: err3 } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .lt('stock', 5); // placeholder threshold
    if (err3) throw err3;
    document.getElementById('stat-bajo-stock').textContent = countStock || 0;

    // Ventas hoy
    const { data: ventasHoy, error: err4 } = await supabase
      .from('sales')
      .select('total')
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString());
    if (err4) throw err4;
    
    const totalVentas = ventasHoy ? ventasHoy.reduce((sum, v) => sum + Number(v.total), 0) : 0;
    document.getElementById('stat-ventas-hoy').textContent = formatCurrency(totalVentas);

  } catch (error) {
    console.error('Error loading stats', error);
  }
}

async function loadRecentActivity() {
  try {
    // Recent reservations
    const { data: resData, error: resError } = await supabase
      .from('reservations')
      .select('id, start_time, status, spaces(name)')
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (resError) throw resError;
    
    const resList = document.getElementById('recent-reservations-list');
    if (!resData || resData.length === 0) {
      resList.innerHTML = '<li>No hay reservas recientes</li>';
    } else {
      resList.innerHTML = resData.map(r => `
        <li class="item-list-row">
          <span>${r.spaces?.name || 'Espacio'} - ${new Date(r.start_time).toLocaleDateString()}</span>
          ${renderBadge(r.status)}
        </li>
      `).join('');
    }

    // Recent sales
    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select('id, created_at, total')
      .order('created_at', { ascending: false })
      .limit(5);

    if (salesError) throw salesError;

    const salesList = document.getElementById('recent-sales-list');
    if (!salesData || salesData.length === 0) {
      salesList.innerHTML = '<li>No hay ventas recientes</li>';
    } else {
      salesList.innerHTML = salesData.map(s => `
        <li class="item-list-row">
          <span>Venta #${String(s.id).substring(0,6)} - ${new Date(s.created_at).toLocaleTimeString()}</span>
          <span>${formatCurrency(s.total)}</span>
        </li>
      `).join('');
    }

  } catch (error) {
    console.error('Error loading recent activity', error);
  }
}
