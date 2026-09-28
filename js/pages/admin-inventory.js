import { supabase } from '../supabase.js';
import { getCurrentUser, isAdmin } from '../auth.js';
import { showToast, showModal, showConfirm, setLoading, formatDate, formatCurrency, renderBadge, escapeHtml, closeModal, getLocalDateString, getLocalDateRange } from '../ui.js';
import { navigateTo } from '../router.js';
import { renderProductForm, getProductFormData } from '../components/product-form.js';
import { renderCartItem, renderCartSummary } from '../components/sale-form.js';

let products = [];
let cart = [];
let currentTab = 'inventory';

function findProductById(id) {
    return products.find(product => String(product.id) === String(id));
}

function isLowStock(product) {
    return Number(product.stock ?? 0) <= Number(product.min_stock ?? 0);
}

export function render() {
    return `
        <div class="page-container">
            <header class="page-header flex justify-between items-center mb-4">
                <h2>Inventario</h2>
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
                            <div id="cart-daily-summary" class="p-3 border-b border-gray-700 bg-gray-800/60">
                                <div class="text-xs uppercase tracking-wide text-gray-400 mb-2">Resumen del día</div>
                                <div class="grid grid-cols-2 gap-2 text-sm">
                                    <div class="bg-gray-900/70 rounded p-2">
                                        <div class="text-gray-400">Productos</div>
                                        <div id="cart-day-products" class="font-bold text-white">0</div>
                                    </div>
                                    <div class="bg-gray-900/70 rounded p-2">
                                        <div class="text-gray-400">Unidades</div>
                                        <div id="cart-day-qty" class="font-bold text-white">0</div>
                                    </div>
                                    <div class="bg-gray-900/70 rounded p-2 col-span-2">
                                        <div class="text-gray-400">Recaudado</div>
                                        <div id="cart-day-total" class="font-bold text-green-400">$0.00</div>
                                    </div>
                                </div>
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
                                        <th>Productos</th>
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

        document.getElementById('history-date').value = getLocalDateString();

        await loadProducts();
        checkLowStock();

        // Event Listeners
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
        });

        document.getElementById('btn-add-product').addEventListener('click', showAddProductModal);
        document.getElementById('inventory-search').addEventListener('input', renderInventoryGrid);
        document.getElementById('inventory-category-filter').addEventListener('change', renderInventoryGrid);
        document.addEventListener('click', handleInventoryActionClick);
        document.getElementById('history-date').addEventListener('change', loadSalesHistory);

        // Initial setup
        renderInventoryGrid();
        renderPosGrid();
        await loadDailySalesSummary();
        await loadSalesHistory();
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
    const lowStockCount = products.filter(isLowStock).length;
    const alert = document.getElementById('low-stock-alert');
    if (lowStockCount > 0) {
        alert.textContent = `¡Atención! ${lowStockCount} productos están en su stock mínimo y deben comprarse.`;
        alert.classList.remove('hidden');
    } else {
        alert.classList.add('hidden');
    }
}

async function getProductNameLookup(productIds) {
    if (!productIds || productIds.length === 0) return {};

    const uniqueIds = [...new Set(productIds.filter(Boolean))];
    if (uniqueIds.length === 0) return {};

    const { data, error } = await supabase
        .from('products')
        .select('id, name')
        .in('id', uniqueIds);

    if (error) throw error;

    return Object.fromEntries((data || []).map(product => [String(product.id), product.name]));
}

function renderInventoryGrid() {
    const search = document.getElementById('inventory-search').value.toLowerCase();
    const category = document.getElementById('inventory-category-filter').value;
    const grid = document.getElementById('inventory-grid');

    const orderedCategories = [
        { key: 'refresco', label: 'Bebidas' },
        { key: 'mekato', label: 'Mekato' },
        { key: 'cerveza', label: 'Cerveza' },
        { key: 'otro', label: 'Otros' }
    ];

    const filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search);
        const matchesCat = category === 'all' || p.category === category;
        return matchesSearch && matchesCat;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500">No se encontraron productos</div>';
        return;
    }

    const grouped = orderedCategories.map(section => {
        const items = filtered.filter(p => p.category === section.key);
        return { ...section, items };
    });

    const visibleGroups = grouped.filter(section => section.items.length > 0);

    if (visibleGroups.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500">No se encontraron productos</div>';
        return;
    }

    grid.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 col-span-full w-full">
            ${visibleGroups.map(section => {
                const itemsHtml = section.items.map(p => {
                    let stockClass = 'bg-green-100 text-green-800';
                    let cardClass = '';
                    const isStockCritical = isLowStock(p);
                    if (isStockCritical) {
                        stockClass = 'bg-red-100 text-red-800';
                        cardClass = 'border-l-4 border-red-500';
                    } else if (p.stock <= p.min_stock * 2) {
                        stockClass = 'bg-orange-100 text-orange-800';
                    }

                    const stockAlert = isStockCritical ? `
                        <div class="mb-2 rounded border border-red-300 bg-red-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-red-700">
                            Stock mínimo • Debe comprarse
                        </div>
                    ` : '';

                    return `
                        <div class="card p-3 flex flex-col ${cardClass}">
                            ${stockAlert}
                            <div class="flex justify-between items-center gap-2 mb-2">
                                <h4 class="font-bold text-sm truncate" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</h4>
                            </div>
                            <div class="text-lg font-bold text-green-700 mb-2">${formatCurrency(p.price)}</div>
                            <div class="mt-auto flex justify-between items-center gap-2">
                                <span class="badge ${stockClass}">Stock: ${p.stock}</span>
                                <div class="flex gap-2 inventory-actions">
                                    <button type="button" class="btn btn--sm edit-product-btn" data-product-id="${p.id}" aria-label="Editar producto">✏️ Editar</button>
                                    <button type="button" class="btn btn--sm delete-product-btn" data-product-id="${p.id}" aria-label="Eliminar producto">🗑️ Borrar</button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');

                return `
                    <div class="card p-3">
                        <div class="card__header px-0 pt-0 pb-3 mb-2 border-b border-gray-700">
                            <h3 class="text-lg font-bold text-white">${section.label}</h3>
                        </div>
                        <div class="space-y-3">
                            ${itemsHtml}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function handleInventoryActionClick(event) {
    const editButton = event.target.closest('.edit-product-btn');
    if (editButton) {
        event.preventDefault();
        event.stopPropagation();
        window.editProduct(editButton.dataset.productId);
        return;
    }

    const deleteButton = event.target.closest('.delete-product-btn');
    if (deleteButton) {
        event.preventDefault();
        event.stopPropagation();
        window.deleteProduct(deleteButton.dataset.productId);
    }
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
    const product = findProductById(id);
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
    const orderedCategories = [
        { key: 'refresco', label: 'Bebidas' },
        { key: 'mekato', label: 'Mekato' },
        { key: 'cerveza', label: 'Cerveza' },
        { key: 'otro', label: 'Otros' }
    ];

    const visibleProducts = products.filter(p => p.stock > 0);
    const grouped = orderedCategories.map(section => {
        const items = visibleProducts.filter(p => p.category === section.key);
        return { ...section, items };
    }).filter(section => section.items.length > 0);

    if (grouped.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500">No hay productos disponibles</div>';
        return;
    }

    grid.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
            ${grouped.map(section => `
                <div class="card p-3">
                    <div class="card__header px-0 pt-0 pb-3 mb-3 border-b border-gray-700">
                        <h3 class="text-lg font-bold text-white">${section.label}</h3>
                    </div>
                    <div class="space-y-2">
                        ${section.items.map(p => `
                            <button type="button" class="w-full text-left rounded-lg border p-3 bg-gray-800 hover:bg-gray-700 transition-colors ${isLowStock(p) ? 'border-red-400' : 'border-gray-600'}" onclick="window.addToCart('${p.id}')">
                                <div class="flex justify-between items-center gap-2">
                                    <span class="font-semibold text-sm text-white">${escapeHtml(p.name)}</span>
                                    <span class="text-xs text-gray-300">Stock: ${p.stock}</span>
                                </div>
                                ${isLowStock(p) ? '<div class="mt-1 text-xs font-semibold text-red-300">Stock mínimo • Debe comprarse</div>' : ''}
                                <div class="mt-1 text-green-400 font-bold">${formatCurrency(p.price)}</div>
                            </button>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

window.addToCart = (productId) => {
    const product = findProductById(productId);
    if (!product) return;

    const existing = cart.find(i => String(i.product.id) === String(productId));
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
    const item = cart.find(i => String(i.product.id) === String(productId));
    if (!item) return;

    const newQ = item.quantity + delta;
    if (newQ <= 0) {
        cart = cart.filter(i => String(i.product.id) !== String(productId));
    } else if (newQ > item.product.stock) {
        showToast('No hay suficiente stock', 'error');
    } else {
        item.quantity = newQ;
    }
    updateCartUI();
};

window.removeFromCart = (productId) => {
    cart = cart.filter(i => String(i.product.id) !== String(productId));
    updateCartUI();
};

async function loadDailySalesSummary() {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const start = todayStart.toISOString();
        const end = todayEnd.toISOString();

        const { data: sales, error: salesError } = await supabase
            .from('sales')
            .select('id, total, created_at')
            .gte('created_at', start)
            .lte('created_at', end)
            .order('created_at', { ascending: false });

        if (salesError) throw salesError;

        const saleIds = (sales || []).map(sale => sale.id);
        let totalUnits = 0;
        let productSet = new Set();
        let totalRevenue = 0;

        if (saleIds.length > 0) {
            const { data: items, error: itemsError } = await supabase
                .from('sale_items')
                .select('sale_id, product_id, quantity')
                .in('sale_id', saleIds);

            if (itemsError) throw itemsError;

            totalUnits = (items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);

            const productIds = [...new Set((items || []).map(item => item.product_id).filter(Boolean))];
            const productLookup = await getProductNameLookup(productIds);
            (items || []).forEach(item => {
                const productName = productLookup[String(item.product_id)];
                if (productName) productSet.add(productName);
            });
        }

        totalRevenue = (sales || []).reduce((sum, sale) => sum + Number(sale.total || 0), 0);

        const productsCount = productSet.size;
        document.getElementById('cart-day-products').textContent = String(productsCount);
        document.getElementById('cart-day-qty').textContent = String(totalUnits);
        document.getElementById('cart-day-total').textContent = formatCurrency(totalRevenue);
    } catch (error) {
        console.error('Error loading daily sales summary:', error);
    }
}

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
        await loadDailySalesSummary();
        await loadSalesHistory();
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

        const { start, end } = getLocalDateRange(dateStr);

        const { data, error } = await supabase
            .from('sales')
            .select('*')
            .gte('created_at', start)
            .lte('created_at', end)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const tbody = document.getElementById('sales-history-body');
        const dailyTotal = (data || []).reduce((sum, s) => sum + Number(s.total), 0);
        document.getElementById('sales-daily-total').textContent = formatCurrency(dailyTotal);

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay ventas registradas en esta fecha.</td></tr>';
            return;
        }

        const saleIds = data.map(sale => sale.id);
        const userIds = [...new Set((data || []).map(sale => sale.sold_by).filter(Boolean))];

        const { data: saleItems, error: itemsError } = await supabase
            .from('sale_items')
            .select('sale_id, product_id, quantity, unit_price, subtotal')
            .in('sale_id', saleIds);

        if (itemsError) throw itemsError;

        let profileLookup = {};
        if (userIds.length > 0) {
            const { data: profileRows, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name')
                .in('id', userIds);

            if (profilesError) throw profilesError;
            profileLookup = Object.fromEntries((profileRows || []).map(profile => [String(profile.id), profile.full_name]));
        }

        const productIds = [...new Set((saleItems || []).map(item => item.product_id).filter(Boolean))];
        const productLookup = await getProductNameLookup(productIds);

        const productsBySale = (saleItems || []).reduce((acc, item) => {
            const key = String(item.sale_id);
            if (!acc[key]) acc[key] = [];
            acc[key].push({
                ...item,
                productName: productLookup[String(item.product_id)] || 'Producto'
            });
            return acc;
        }, {});

        tbody.innerHTML = data.map(sale => {
            const items = productsBySale[String(sale.id)] || [];
            const productList = items.length
                ? items.map(item => `${item.productName} (${item.quantity})`).join(', ')
                : 'Sin productos';

            return `
                <tr>
                    <td>#${String(sale.id).substring(0,8)}</td>
                    <td>${formatDate(sale.created_at)}</td>
                    <td>${escapeHtml(profileLookup[String(sale.sold_by)] || 'Sistema')}</td>
                    <td class="text-sm max-w-xs">${escapeHtml(productList)}</td>
                    <td class="font-bold">${formatCurrency(sale.total)}</td>
                    <td>
                        <button class="btn btn--sm" onclick="window.viewSaleDetail('${sale.id}')">Ver Detalle</button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading sales history:', error);
        showToast('Error al cargar historial', 'error');
    }
}

window.viewSaleDetail = async (saleId) => {
    try {
        const { data, error } = await supabase
            .from('sale_items')
            .select('sale_id, product_id, quantity, unit_price, subtotal')
            .eq('sale_id', saleId);

        if (error) throw error;

        const productIds = [...new Set((data || []).map(item => item.product_id).filter(Boolean))];
        const productLookup = await getProductNameLookup(productIds);

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
                    ${(data || []).map(item => {
                        const productName = productLookup[String(item.product_id)] || 'Desconocido';
                        return `
                            <tr>
                                <td>${escapeHtml(productName)}</td>
                                <td>${item.quantity}</td>
                                <td>${formatCurrency(item.unit_price)}</td>
                                <td>${formatCurrency(item.subtotal)}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        
        showModal('Detalle de Venta', html);
    } catch (error) {
        console.error('Error viewing sale details', error);
        showToast('Error al cargar detalles', 'error');
    }
};
