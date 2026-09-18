import { supabase } from '../supabase.js';
import { getCurrentUser, isAdmin } from '../auth.js';
import { showToast, setLoading, formatCurrency } from '../ui.js';
import { navigateTo } from '../router.js';
import { renderBarChart, destroyChart } from '../components/chart.js';

export function render() {
    return `
        <div class="page-container">
            <header class="page-header flex justify-between items-center mb-4">
                <h2>Reportes</h2>
                <div class="flex gap-2">
                    <input type="date" id="report-start" class="form-input w-auto">
                    <input type="date" id="report-end" class="form-input w-auto">
                    <button id="btn-generate-report" class="btn btn--primary">Generar Reporte</button>
                </div>
            </header>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div class="card">
                    <div class="card__header">
                        <h3>Resumen de Ventas</h3>
                    </div>
                    <div class="card__body">
                        <div class="grid grid-cols-2 gap-4 mb-4">
                            <div class="stat-card">
                                <div class="text-sm text-gray-500">Total Productos</div>
                                <div id="stat-total-products" class="text-2xl font-bold">0</div>
                            </div>
                            <div class="stat-card">
                                <div class="text-sm text-gray-500">Ingresos Totales</div>
                                <div id="stat-total-revenue" class="text-2xl font-bold text-green-600">$0</div>
                            </div>
                        </div>
                        <h4 class="font-bold mb-2">Productos Más Vendidos</h4>
                        <div id="sales-chart-container" style="height: 300px; width: 100%; position: relative;"></div>
                    </div>
                </div>

                <div class="card">
                    <div class="card__header">
                        <h3>Resumen de Reservas</h3>
                    </div>
                    <div class="card__body">
                        <div id="reservations-summary">
                            <p class="text-gray-500">Genera el reporte para ver datos.</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card__header">
                    <h3>Detalle de Productos Vendidos</h3>
                </div>
                <div class="card__body">
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Producto</th>
                                    <th>Categoría</th>
                                    <th>Unidades Vendidas</th>
                                    <th>Ingresos</th>
                                </tr>
                            </thead>
                            <tbody id="report-products-table">
                                <tr><td colspan="5" class="text-center text-gray-500">Genera el reporte para ver datos.</td></tr>
                            </tbody>
                        </table>
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

        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 30);

        document.getElementById('report-start').value = start.toISOString().split('T')[0];
        document.getElementById('report-end').value = end.toISOString().split('T')[0];

        document.getElementById('btn-generate-report').addEventListener('click', generateReports);

        // Generate initially
        await generateReports();
    } catch (error) {
        console.error('Error init reports:', error);
    }
}

async function generateReports() {
    try {
        setLoading(true);
        const start = document.getElementById('report-start').value + 'T00:00:00Z';
        const end = document.getElementById('report-end').value + 'T23:59:59Z';

        await Promise.all([
            generateSalesReports(start, end),
            generateReservationsReport(start, end)
        ]);

    } catch (error) {
        console.error('Error generating reports:', error);
        showToast('Error al generar reportes', 'error');
    } finally {
        setLoading(false);
    }
}

async function generateSalesReports(start, end) {
    const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('id, created_at')
        .gte('created_at', start)
        .lte('created_at', end);

    if (salesError) throw salesError;

    if (!sales || sales.length === 0) {
        renderEmptySales();
        return;
    }

    const saleIds = sales.map(s => s.id);
    const { data: items, error: itemsError } = await supabase
        .from('sale_items')
        .select('quantity, unit_price, subtotal, product_id, products(name, category)')
        .in('sale_id', saleIds);

    if (itemsError) throw itemsError;

    // Aggregate data
    const productStats = {};
    let totalQty = 0;
    let totalRev = 0;

    items.forEach(item => {
        totalQty += item.quantity;
        totalRev += Number(item.subtotal);
        const pId = item.product_id;
        if (!productStats[pId]) {
            productStats[pId] = {
                name: item.products?.name || 'Desconocido',
                category: item.products?.category || 'N/A',
                quantity: 0,
                revenue: 0
            };
        }
        productStats[pId].quantity += item.quantity;
        productStats[pId].revenue += Number(item.subtotal);
    });

    const sortedProducts = Object.values(productStats).sort((a, b) => b.quantity - a.quantity);

    // Update stats
    document.getElementById('stat-total-products').textContent = totalQty;
    document.getElementById('stat-total-revenue').textContent = formatCurrency(totalRev);

    // Render chart
    destroyChart('sales-chart-container');
    if (sortedProducts.length > 0) {
        const chartData = sortedProducts.slice(0, 5).map(p => ({
            label: p.name,
            value: p.quantity
        }));
        renderBarChart('sales-chart-container', chartData, { horizontal: true });
    }

    // Render table
    const tbody = document.getElementById('report-products-table');
    tbody.innerHTML = sortedProducts.map((p, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${p.name}</td>
            <td><span class="badge bg-gray-200">${p.category}</span></td>
            <td>${p.quantity}</td>
            <td>${formatCurrency(p.revenue)}</td>
        </tr>
    `).join('');
}

function renderEmptySales() {
    document.getElementById('stat-total-products').textContent = '0';
    document.getElementById('stat-total-revenue').textContent = '$0';
    destroyChart('sales-chart-container');
    document.getElementById('sales-chart-container').innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">Sin ventas en este periodo</div>';
    document.getElementById('report-products-table').innerHTML = '<tr><td colspan="5" class="text-center text-gray-500">Sin datos</td></tr>';
}

async function generateReservationsReport(start, end) {
    const { data, error } = await supabase
        .from('reservations')
        .select('status, spaces(name, type)')
        .gte('start_time', start)
        .lte('start_time', end);

    if (error) throw error;

    const summary = document.getElementById('reservations-summary');
    if (!data || data.length === 0) {
        summary.innerHTML = '<p class="text-gray-500">Sin reservas en este periodo.</p>';
        return;
    }

    const byStatus = data.reduce((acc, curr) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
    }, {});

    const byType = data.reduce((acc, curr) => {
        const type = curr.spaces?.type || 'Desconocido';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {});

    summary.innerHTML = `
        <div class="mb-4">
            <h5 class="font-bold text-sm mb-2 text-gray-600">Por Estado</h5>
            <ul class="space-y-1">
                ${Object.entries(byStatus).map(([status, count]) => `
                    <li class="flex justify-between">
                        <span>${status}</span>
                        <span class="font-bold">${count}</span>
                    </li>
                `).join('')}
            </ul>
        </div>
        <div>
            <h5 class="font-bold text-sm mb-2 text-gray-600">Por Tipo de Espacio</h5>
            <ul class="space-y-1">
                ${Object.entries(byType).map(([type, count]) => `
                    <li class="flex justify-between">
                        <span class="capitalize">${type}</span>
                        <span class="font-bold">${count}</span>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;
}
