import { supabase } from '../supabase.js';
import { isAdmin } from '../auth.js';
import { showToast, setLoading, formatCurrency, renderBadge, escapeHtml } from '../ui.js';
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
      </div>

      <div class="dashboard-panels">
        <section class="dashboard-list chart-panel">
          <div class="panel-heading"><h3>TOP PRODUCTOS MÁS VENDIDOS</h3><span></span></div>
          <div id="top-products-chart" class="bar-chart" aria-label="Productos más vendidos"></div>
          <div id="top-products-labels" class="chart-labels"></div>
          <div style="display:flex; justify-content:center; align-items:center; gap:8px; margin-top:12px; font-size:12px; color:#d1d5db;">
            <label for="dashboard-month-filter" style="font-weight:600;">Mes</label>
            <input type="month" id="dashboard-month-filter" class="form-input w-auto" style="min-width: 140px;" />
          </div>
        </section>
        <section class="dashboard-list dashboard-list--wide">
          <div class="panel-heading"><h3>INVENTARIO EN ALERTA DE STOCK</h3><span></span></div>
          <ul id="recent-sales-list" class="item-list">Cargando...</ul>
          <button id="btn-nueva-venta" class="dashboard-cta">COMPRAR SUMINISTROS</button>
        </section>
        <section class="dashboard-list dashboard-list--wide">
          <div class="panel-heading"><h3>GESTIÓN DE RESERVAS Y ACTIVIDADES</h3><span></span></div>
          <ul id="recent-reservations-list" class="item-list">Cargando...</ul>
          <button id="btn-gestionar-reservas" class="dashboard-cta">VER RESERVAS</button>
        </section>
      </div>
    </div>
  `;
}

export async function init() {
  const user = await (await import('../auth.js')).getCurrentUser();
  if (!isAdmin(user)) return;

  const monthInput = document.getElementById('dashboard-month-filter');
  const monthValue = new Date().toISOString().slice(0, 7);
  monthInput.value = monthValue;

  document.getElementById('btn-gestionar-reservas').addEventListener('click', () => navigateTo('#/admin/reservas'));
  document.getElementById('btn-nueva-venta').addEventListener('click', () => navigateTo('#/admin/inventario'));
  monthInput.addEventListener('change', async () => {
    await loadTopProducts();
  });

  await loadStats();
  await loadTopProducts();
  await loadRecentActivity();
}

async function loadTopProducts() {
  try {
    const monthInput = document.getElementById('dashboard-month-filter');
    const selectedMonth = monthInput?.value || new Date().toISOString().slice(0, 7);
    const [year, month] = selectedMonth.split('-').map(Number);
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 1, 0, 0, 0, 0);

    const { data: salesMonth, error: salesError } = await supabase
      .from('sales')
      .select('id')
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString());

    if (salesError) throw salesError;

    if (!salesMonth || salesMonth.length === 0) {
      const chart = document.getElementById('top-products-chart');
      const labels = document.getElementById('top-products-labels');
      if (chart) {
        chart.style.removeProperty('--chart-columns');
        chart.innerHTML = '<div class="empty-chart-state">Sin ventas</div>';
      }
      if (labels) {
        labels.style.removeProperty('--chart-columns');
        labels.innerHTML = '';
      }
      return;
    }

    const saleIds = salesMonth.map(sale => sale.id);
    const { data, error } = await supabase
      .from('sale_items')
      .select('product_id, quantity')
      .in('sale_id', saleIds);

    if (error) throw error;

    const productIds = [...new Set((data || []).map(item => item.product_id).filter(Boolean))];
    const productLookup = {};

    if (productIds.length > 0) {
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name')
        .in('id', productIds);

      if (productsError) throw productsError;

      Object.assign(productLookup, Object.fromEntries((productsData || []).map(product => [String(product.id), product.name])));
    }

    const totals = {};
    for (const item of data || []) {
      const productName = productLookup[String(item.product_id)] || 'Sin nombre';
      totals[productName] = (totals[productName] || 0) + Number(item.quantity || 0);
    }

    const entries = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const chart = document.getElementById('top-products-chart');
    const labels = document.getElementById('top-products-labels');

    if (!chart || !labels) return;

    if (!entries.length) {
      chart.innerHTML = '<div class="empty-chart-state">Sin ventas</div>';
      chart.style.removeProperty('--chart-columns');
      labels.style.removeProperty('--chart-columns');
      labels.innerHTML = '';
      return;
    }

    const maxValue = Math.max(...entries.map(([, value]) => value), 1);
    chart.style.setProperty('--chart-columns', entries.length);
    labels.style.setProperty('--chart-columns', entries.length);
    chart.innerHTML = entries.map(([, value]) => `
      <i style="height: ${Math.max((value / maxValue) * 100, 12)}%"></i>
    `).join('');
    labels.innerHTML = entries.map(([name, qty]) => `<span title="${escapeHtml(name)}">${escapeHtml(name)} (${qty})</span>`).join('');
  } catch (error) {
    console.error('Error loading top products', error);
  }
}

async function loadStats() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { count: countHoy, error: err1 } = await supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .gte('start_time', today.toISOString())
      .lt('start_time', tomorrow.toISOString())
      .not('status', 'eq', 'cancelada');
    if (err1) throw err1;
    document.getElementById('stat-res-hoy').textContent = countHoy || 0;

    const { data: productsData, error: err2 } = await supabase
      .from('products')
      .select('stock, min_stock');
    if (err2) throw err2;

    const lowStockProducts = (productsData || []).filter(product => Number(product.stock ?? 0) <= Number(product.min_stock ?? 0));
    document.getElementById('stat-bajo-stock').textContent = lowStockProducts.length;

    const { data: ventasHoy, error: err3 } = await supabase
      .from('sales')
      .select('total')
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString());
    if (err3) throw err3;

    const totalVentas = ventasHoy ? ventasHoy.reduce((sum, v) => sum + Number(v.total), 0) : 0;
    document.getElementById('stat-ventas-hoy').textContent = formatCurrency(totalVentas);

  } catch (error) {
    console.error('Error loading stats', error);
  }
}

async function loadRecentActivity() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: resData, error: resError } = await supabase
      .from('reservations')
      .select('id, start_time, status, spaces(name)')
      .gte('start_time', today.toISOString())
      .lt('start_time', tomorrow.toISOString())
      .order('start_time', { ascending: true })
      .limit(5);

    if (resError) throw resError;

    const resList = document.getElementById('recent-reservations-list');
    if (!resData || resData.length === 0) {
      resList.innerHTML = '<li>No hay reservas para hoy</li>';
    } else {
      resList.innerHTML = resData.map(r => `
        <li class="item-list-row">
          <span>${r.spaces?.name || 'Espacio'} - ${new Date(r.start_time).toLocaleDateString()}</span>
          ${renderBadge(r.status)}
        </li>
      `).join('');
    }

    const { data: stockAlertData, error: stockAlertError } = await supabase
      .from('products')
      .select('id, name, stock, min_stock')
      .order('stock', { ascending: true })
      .limit(5);

    if (stockAlertError) throw stockAlertError;

    const lowStockProducts = (stockAlertData || []).filter(product => Number(product.stock ?? 0) <= Number(product.min_stock ?? 0));

    const salesList = document.getElementById('recent-sales-list');
    if (!lowStockProducts || lowStockProducts.length === 0) {
      salesList.innerHTML = '<li>No hay productos en stock mínimo</li>';
    } else {
      salesList.innerHTML = lowStockProducts.map(product => `
        <li class="item-list-row">
          <span>${product.name}</span>
          <span class="text-red-300">Stock: ${product.stock}/${product.min_stock}</span>
        </li>
      `).join('');
    }

  } catch (error) {
    console.error('Error loading recent activity', error);
  }
}
