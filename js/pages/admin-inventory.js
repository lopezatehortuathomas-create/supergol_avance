import { supabase } from '../supabase.js';
import { getCurrentUser, isAdmin } from '../auth.js';
import { showToast, showModal, showConfirm, setLoading, formatDate, formatCurrency, renderBadge, escapeHtml, closeModal } from '../ui.js';
import { navigateTo } from '../router.js';
import { renderProductForm, getProductFormData } from '../components/product-form.js';
import { renderCartItem, renderCartSummary } from '../components/sale-form.js';

let products = [];
let cart = [];
let currentTab = 'inventory';

export function render() {
    return `
        <div class="page-container">
            <header class="page-header flex justify-between items-center mb-4">
                <h2>Inventario y Ventas</h2>
                <div class="tabs">
                    <button class="tab tab--active" data-tab="inventory">Inventario</button>
                    <button class="tab" data-tab="pos">Nueva Venta</button>
                    <button class="tab" data-tab="history">Historial de Ventas</button>
                </div>
            </header>

            <div id="low-stock-alert" class="alert alert--warning hidden mb-4">
                ¡Atención! Hay productos con stock bajo.
            </div>

            <!-- Inventory Tab -->
            <div id="tab-inventory" class="tab-content">
                <div class="card">
                    <div class="card__header flex justify-between items-center">
                        <div class="flex gap-2">
                            <input type="text" id="inventory-search" class="search-bar" placeholder="Buscar producto...">
                            <select id="inventory-category-filter" class="form-input w-auto">
                                <option value="all">Todas las categorías</option>
                                <option value="refresco">Refresco</option>
                                <option value="mekato">Mekato</option>
                                <option value="cerveza">Cerveza</option>
                                <option value="otro">Otro</option>
                            </select>
                        </div>
                        <button id="btn-add-product" class="btn btn--primary">Agregar Producto</button>
                    </div>
                    <div class="card__body">
                        <div id="inventory-grid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            <!-- Products will be loaded here -->
                        </div>
                    </div>
                </div>
            </div>

            <!-- POS Tab -->
            <div id="tab-pos" class="tab-content hidden">
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div class="lg:col-span-2">
                        <div class="card">
                            <div class="card__header">
                                <h3>Productos</h3>
                            </div>
                            <div class="card__body">
                                <div id="pos-grid" class="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    <!-- POS Products will be loaded here -->
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="lg:col-span-1">
                        <div class="card h-full flex flex-col">
                            <div class="card__header">
                                <h3>Carrito</h3>
                            </div>
                            <div class="card__body flex-1 overflow-y-auto p-0">
                                <div id="cart-items" class="divide-y">
                                    <div class="p-4 text-center text-gray-500">Agrega productos al carrito</div>
                                </div>
                            </div>
                            <div class="p-4 border-t" id="cart-summary">
                                <!-- Summary will be rendered here -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- History Tab -->
            <div id="tab-history" class="tab-content hidden">
                <div class="card">
                    <div class="card__header flex justify-between items-center">
                        <h3>Historial de Ventas</h3>
                        <div class="flex gap-2 items-center">
                            <label class="font-bold">Total del día: <span id="sales-daily-total" class="text-green-600">$0.00</span></label>
                            <input type="date" id="history-date" class="form-input w-auto">
                        </div>
                    </div>
                    <div class="card__body">
                        <div class="table-responsive">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Fecha</th>
                                        <th>Vendido por</th>
                                        <th>Total</th>
                                        <th>Detalle</th>
                                    </tr>
                                </thead>
                                <tbody id="sales-history-body">
                                </tbody>
                            </table>
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

        document.getElementById('history-date').value = new Date().toISOString().split('T')[0];

        await loadProducts();
        checkLowStock();

        // Event Listeners
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
        });

        document.getElementById('btn-add-product').addEventListener('click', showAddProductModal);
        document.getElementById('inventory-search').addEventListener('input', renderInventoryGrid);
        document.getElementById('inventory-category-filter').addEventListener('change', renderInventoryGrid);
        
        document.getElementById('history-date').addEventListener('change', loadSalesHistory);

        // Initial setup
        renderInventoryGrid();
        renderPosGrid();
        updateCartUI();
        
    } catch (error) {
        console.error('Error initializing admin-inventory:', error);
        showToast('Error al inicializar la página', 'error');
    }
}

function switchTab(tabId) {
    currentTab = tabId;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('tab--active'));
    document.querySelector(`.tab[data-tab="${tabId}"]`).classList.add('tab--active');
    
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.getElementById(`tab-${tabId}`).classList.remove('hidden');

    if (tabId === 'history') {
        loadSalesHistory();
    }
}

async function loadProducts() {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('is_active', true)
            .order('name');
        
        if (error) throw error;
        products = data;
    } catch (error) {
        console.error('Error loading products:', error);
        showToast('Error al cargar productos', 'error');
    }
}

function checkLowStock() {
    const lowStockCount = products.filter(p => p.stock <= p.min_stock).length;
    const alert = document.getElementById('low-stock-alert');
    if (lowStockCount > 0) {
        alert.textContent = `¡Atención! ${lowStockCount} productos tienen stock bajo.`;
        alert.classList.remove('hidden');
    } else {
        alert.classList.add('hidden');
    }
}

function renderInventoryGrid() {
    const search = document.getElementById('inventory-search').value.toLowerCase();
    const category = document.getElementById('inventory-category-filter').value;
    const grid = document.getElementById('inventory-grid');

    const filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search);
        const matchesCat = category === 'all' || p.category === category;
        return matchesSearch && matchesCat;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500">No se encontraron productos</div>';
        return;
    }

    grid.innerHTML = filtered.map(p => {
        let stockClass = 'bg-green-100 text-green-800';
        let cardClass = '';
        if (p.stock <= p.min_stock) {
            stockClass = 'bg-red-100 text-red-800';
            cardClass = 'border-l-4 border-red-500';
        } else if (p.stock <= p.min_stock * 2) {
            stockClass = 'bg-orange-100 text-orange-800';
        }

        return `
            <div class="card p-4 flex flex-col ${cardClass}">
                <div class="flex justify-between items-start mb-2">
                    <h4 class="font-bold truncate" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</h4>
                    <span class="badge bg-gray-200 text-xs">${escapeHtml(p.category)}</span>
                </div>
                <div class="text-xl font-bold text-green-700 mb-2">${formatCurrency(p.price)}</div>
                <div class="mt-auto flex justify-between items-center">
                    <span class="badge ${stockClass}">Stock: ${p.stock}</span>
                    <div class="flex gap-1">
                        <button class="btn btn--sm" onclick="window.editProduct('${p.id}')">✏️</button>
                        <button class="btn btn--sm btn--danger" onclick="window.deleteProduct('${p.id}')">🗑️</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function showAddProductModal() {
    showModal('Agregar Producto', renderProductForm(), async () => {
        const form = document.getElementById('product-form');
        const data = getProductFormData(form);
        if (!data) return false;

        try {
            const { error } = await supabase.from('products').insert([data]);
            if (error) throw error;
            
            showToast('Producto agregado', 'success');
            await loadProducts();
            renderInventoryGrid();
            renderPosGrid();
            checkLowStock();
            return true;
        } catch (error) {
            console.error('Error saving product:', error);
            showToast('Error al guardar el producto', 'error');
            return false;
        }
    });
}

window.editProduct = async (id) => {
    const product = products.find(p => p.id === id);
    if (!product) return;

    showModal('Editar Producto', renderProductForm(product), async () => {
        const form = document.getElementById('product-form');
        const data = getProductFormData(form);
        if (!data) return false;

        try {
            const { error } = await supabase.from('products').update(data).eq('id', id);
            if (error) throw error;
            
            showToast('Producto actualizado', 'success');
            await loadProducts();
            renderInventoryGrid();
            renderPosGrid();
            checkLowStock();
            return true;
        } catch (error) {
            console.error('Error updating product:', error);
            showToast('Error al actualizar', 'error');
            return false;
        }
    });
};

window.deleteProduct = (id) => {
    showConfirm('¿Estás seguro?', 'El producto será marcado como inactivo.', async () => {
        try {
            const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id);
            if (error) throw error;
            showToast('Producto eliminado', 'success');
            await loadProducts();
            renderInventoryGrid();
            renderPosGrid();
        } catch (error) {
            console.error('Error deleting product', error);
            showToast('Error al eliminar', 'error');
        }
    });
};

// --- POS Section ---
function renderPosGrid() {
    const grid = document.getElementById('pos-grid');
    grid.innerHTML = products.filter(p => p.stock > 0).map(p => `
        <div class="card p-3 cursor-pointer hover:shadow-lg transition-shadow border ${p.stock <= p.min_stock ? 'border-red-300' : 'border-transparent'}" 
             onclick="window.addToCart('${p.id}')">
            <h5 class="font-bold truncate text-sm">${escapeHtml(p.name)}</h5>
            <div class="flex justify-between items-center mt-2">
                <span class="text-green-700 font-bold">${formatCurrency(p.price)}</span>
                <span class="text-xs text-gray-500">Stock: ${p.stock}</span>
            </div>
        </div>
    `).join('');
}

window.addToCart = (productId) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existing = cart.find(i => i.product.id === productId);
    if (existing) {
        if (existing.quantity >= product.stock) {
            showToast('No hay suficiente stock', 'error');
            return;
        }
        existing.quantity += 1;
    } else {
        cart.push({ product, quantity: 1 });
    }
    updateCartUI();
};

window.updateCartQuantity = (productId, delta) => {
    const item = cart.find(i => i.product.id === productId);
    if (!item) return;

    const newQ = item.quantity + delta;
    if (newQ <= 0) {
        cart = cart.filter(i => i.product.id !== productId);
    } else if (newQ > item.product.stock) {
        showToast('No hay suficiente stock', 'error');
    } else {
        item.quantity = newQ;
    }
    updateCartUI();
};

window.removeFromCart = (productId) => {
    cart = cart.filter(i => i.product.id !== productId);
    updateCartUI();
};

function updateCartUI() {
    const container = document.getElementById('cart-items');
    const summary = document.getElementById('cart-summary');

    if (cart.length === 0) {
        container.innerHTML = '<div class="p-4 text-center text-gray-500">Agrega productos al carrito</div>';
        summary.innerHTML = '';
        return;
    }

    container.innerHTML = cart.map(item => renderCartItem(item)).join('');
    summary.innerHTML = renderCartSummary(cart);

    document.getElementById('btn-checkout')?.addEventListener('click', processSale);
}

async function processSale() {
    if (cart.length === 0) return;

    try {
        setLoading(true);
        const user = await getCurrentUser();
        const total = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

        // Verify stock again
        await loadProducts();
        for (const item of cart) {
            const p = products.find(p => p.id === item.product.id);
            if (!p || p.stock < item.quantity) {
                showToast(`Stock insuficiente para ${item.product.name}`, 'error');
                setLoading(false);
                return;
            }
        }

        // 1. Create Sale
        const { data: saleData, error: saleError } = await supabase
            .from('sales')
            .insert([{ sold_by: user.id, total: total }])
            .select()
            .single();

        if (saleError) throw saleError;

        // 2. Create Sale Items
        const saleItems = cart.map(item => ({
            sale_id: saleData.id,
            product_id: item.product.id,
            quantity: item.quantity,
            unit_price: item.product.price,
            subtotal: item.quantity * item.product.price
        }));

        const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
        if (itemsError) throw itemsError;

        // Note: DB trigger should handle stock reduction

        showToast('Venta registrada exitosamente', 'success');
        cart = [];
        updateCartUI();
        await loadProducts();
        renderInventoryGrid();
        renderPosGrid();
        checkLowStock();

    } catch (error) {
        console.error('Checkout error:', error);
        showToast('Error al procesar la venta', 'error');
    } finally {
        setLoading(false);
    }
}

// --- History Section ---
async function loadSalesHistory() {
    try {
        const dateStr = document.getElementById('history-date').value;
        if (!dateStr) return;

        const start = dateStr + 'T00:00:00Z';
        const end = dateStr + 'T23:59:59Z';

        const { data, error } = await supabase
            .from('sales')
            .select('*, profiles:sold_by(full_name)')
            .gte('created_at', start)
            .lte('created_at', end)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const tbody = document.getElementById('sales-history-body');
        const dailyTotal = data.reduce((sum, s) => sum + Number(s.total), 0);
        document.getElementById('sales-daily-total').textContent = formatCurrency(dailyTotal);

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay ventas registradas en esta fecha.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(sale => `
            <tr>
                <td>#${String(sale.id).substring(0,8)}</td>
                <td>${formatDate(sale.created_at)}</td>
                <td>${escapeHtml(sale.profiles?.full_name || 'Sistema')}</td>
                <td class="font-bold">${formatCurrency(sale.total)}</td>
                <td>
                    <button class="btn btn--sm" onclick="window.viewSaleDetail('${sale.id}')">Ver Detalle</button>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error loading sales history:', error);
        showToast('Error al cargar historial', 'error');
    }
}

window.viewSaleDetail = async (saleId) => {
    try {
        const { data, error } = await supabase
            .from('sale_items')
            .select('*, products(name)')
            .eq('sale_id', saleId);

        if (error) throw error;

        const html = `
            <table class="table w-full">
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Cant.</th>
                        <th>Precio U.</th>
                        <th>Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(item => `
                        <tr>
                            <td>${escapeHtml(item.products?.name || 'Desconocido')}</td>
                            <td>${item.quantity}</td>
                            <td>${formatCurrency(item.unit_price)}</td>
                            <td>${formatCurrency(item.subtotal)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        showModal('Detalle de Venta', html);
    } catch (error) {
        console.error('Error viewing sale details', error);
        showToast('Error al cargar detalles', 'error');
    }
};
