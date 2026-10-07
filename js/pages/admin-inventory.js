import { supabase } from '../supabase.js';
import { getCurrentUser, isAdmin } from '../auth.js';
import { showToast, showModal, showConfirm, setLoading, formatDate, formatCurrency, renderBadge, escapeHtml, closeModal, getLocalDateString, getLocalDateRange } from '../ui.js';
import { navigateTo } from '../router.js';
import { renderProductForm, getProductFormData, getProductImage, updateProductImagePreview } from '../components/product-form.js';
import { renderCartItem, renderCartSummary } from '../components/sale-form.js';

let products = [];
let cart = [];

function findProductById(id) {
    return products.find(product => String(product.id) === String(id));
}

function isLowStock(product) {
    return Number(product.stock ?? 0) <= Number(product.min_stock ?? 0);
}

export function render() {
    return `
        <div class="page-container inventory-page">
            <header class="page-header inventory-page__header flex justify-between items-center mb-4">
                <div>
                    <p class="inventory-eyebrow">ADMINISTRACIÓN · TIENDA</p>
                    <h2>Inventario</h2>
                </div>
            </header>

            <div class="tabs" role="tablist" aria-label="Secciones de inventario">
                <button type="button" class="tab active" data-tab="inventory" role="tab">Catálogo</button>
                <button type="button" class="tab" data-tab="pos" role="tab">Punto de venta</button>
                <button type="button" class="tab" data-tab="history" role="tab">Historial de ventas</button>
            </div>

            <div id="low-stock-alert" class="alert alert--warning hidden mb-4" role="status">
                ¡Atención! Hay productos con stock bajo.
            </div>

            <!-- Inventory Tab -->
            <div id="tab-inventory" class="tab-content">
                <div class="card">
                    <div class="card__header inventory-toolbar">
                        <div class="inventory-toolbar__filters">
                            <label class="inventory-search">
                                <span class="inventory-search__icon" aria-hidden="true">⌕</span>
                                <span class="sr-only">Buscar producto</span>
                                <input type="search" id="inventory-search" class="form-input search-bar__input" placeholder="Buscar producto...">
                            </label>
                            <label class="inventory-category">
                                <span class="sr-only">Filtrar por categoría</span>
                                <select id="inventory-category-filter" class="form-input w-auto">
                                <option value="all">Todas las categorías</option>
                                <option value="refresco">Refresco</option>
                                <option value="mekato">Mekato</option>
                                <option value="cerveza">Cerveza</option>
                                <option value="otro">Otro</option>
                                </select>
                            </label>
                        </div>
                        <button id="btn-add-product" class="btn btn--primary"><span aria-hidden="true">＋</span> Agregar Producto</button>
                    </div>
                    <div class="card__body">
                        <div id="inventory-grid" class="inventory-grid" aria-live="polite">
                            <div class="inventory-skeleton" aria-label="Cargando productos">
                                <span class="inventory-skeleton__ball" aria-hidden="true">⚽</span>
                                <span>Cargando catálogo...</span>
                            </div>
                            <!-- Products will be loaded here -->
                        </div>
                    </div>
                </div>
            </div>

            <div id="tab-pos" class="tab-content hidden">
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div class="lg:col-span-2">
                        <div class="card">
                            <div class="card__header">
                                <h3>Productos para vender</h3>
                            </div>
                            <div class="card__body">
                                <div id="pos-grid" class="pos-grid" aria-live="polite"></div>
                            </div>
                        </div>
                    </div>
                    <div class="lg:col-span-1">
                        <div class="card h-full flex flex-col">
                            <div class="card__header">
                                <h3>Carrito</h3>
                            </div>
                            <div id="cart-daily-summary" class="inventory-day-summary">
                                <div class="inventory-day-summary__title">Resumen del día</div>
                                <div class="inventory-day-summary__grid">
                                    <div class="inventory-day-summary__item">
                                        <div class="inventory-day-summary__value" id="cart-day-products">0</div>
                                        <div class="inventory-day-summary__label">Productos</div>
                                    </div>
                                    <div class="inventory-day-summary__item">
                                        <div class="inventory-day-summary__value" id="cart-day-qty">0</div>
                                        <div class="inventory-day-summary__label">Unidades</div>
                                    </div>
                                    <div class="inventory-day-summary__item">
                                        <div class="inventory-day-summary__value" id="cart-day-total">$0</div>
                                        <div class="inventory-day-summary__label">Recaudado</div>
                                    </div>
                                </div>
                            </div>
                            <div class="card__body flex-1 overflow-y-auto p-0">
                                <div id="cart-items">
                                    <div class="cart-empty">
                                        <span aria-hidden="true">⚽</span>
                                        <strong>Tu carrito está esperando</strong>
                                        <p>Agrega productos para iniciar una venta.</p>
                                    </div>
                                </div>
                            </div>
                            <div class="inventory-cart-summary" id="cart-summary"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- History Tab -->
            <div id="tab-history" class="tab-content hidden">
                <div class="card">
                    <div class="card__header flex justify-between items-center">
                        <h3>Historial de Ventas</h3>
                        <div class="inventory-history-controls">
                            <label class="inventory-sales-total">Total del día <span id="sales-daily-total">$0.00</span></label>
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
        document.addEventListener('click', handleInventoryUtilityClick);
        document.addEventListener('input', handleProductImagePreview);
        document.addEventListener('change', handleProductImagePreview);
        document.addEventListener('click', handlePosProductAnimation);
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
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${tabId}"]`).classList.add('active');
    
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
    const lowStockProducts = products.filter(isLowStock);
    const alert = document.getElementById('low-stock-alert');
    if (lowStockProducts.length > 0) {
        const names = lowStockProducts.map(product => escapeHtml(product.name)).join(', ');
        alert.innerHTML = `<span><strong>${lowStockProducts.length} productos con stock bajo:</strong> ${names}</span><button type="button" class="inventory-low-stock-link" data-show-low-stock>Ver catálogo</button>`;
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
        grid.innerHTML = '<div class="inventory-empty"><span aria-hidden="true">⌕</span><strong>No encontramos productos</strong><p>Prueba con otra búsqueda o categoría.</p></div>';
        return;
    }

    const grouped = orderedCategories.map(section => {
        const items = filtered.filter(p => p.category === section.key);
        return { ...section, items };
    });

    const visibleGroups = grouped.filter(section => section.items.length > 0);

    if (visibleGroups.length === 0) {
        grid.innerHTML = '<div class="inventory-empty"><span aria-hidden="true">⌕</span><strong>No encontramos productos</strong><p>Prueba con otra búsqueda o categoría.</p></div>';
        return;
    }

    grid.innerHTML = `
        ${visibleGroups.map(section => {
                const itemsHtml = section.items.map(p => {
                    let stockClass = 'product-stock--normal';
                    const isStockCritical = isLowStock(p);
                    if (Number(p.stock) <= 0) stockClass = 'product-stock--empty';
                    else if (isStockCritical || p.stock <= p.min_stock * 2) stockClass = 'product-stock--low';

                    const stockAlert = isStockCritical ? `
                        <div class="product-stock-warning">
                            Stock mínimo • Debe comprarse
                        </div>
                    ` : '';

                    return `
                        <article class="card product-card ${Number(p.stock) <= 0 ? 'product-card--empty-stock' : ''}">
                            <div class="product-card__media">
                                <img class="product-card__image" src="${getProductImage(p.name, p.category)}"
                                     alt="${escapeHtml(p.name)}" loading="lazy"
                                     onerror="this.onerror=null;this.src='img/productos/generico.svg'">
                            </div>
                            <div class="product-card__content">
                                ${stockAlert}
                                <h4 class="product-card__title" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</h4>
                                <div class="product-card__price">${formatCurrency(p.price)}</div>
                                <div class="product-card__meta">
                                    <span class="product-stock ${stockClass}">${Number(p.stock) <= 0 ? 'Agotado' : `Stock: ${p.stock}`}</span>
                                </div>
                                <div class="flex gap-2 inventory-actions">
                                    <button type="button" class="btn btn--sm edit-product-btn" data-product-id="${p.id}" aria-label="Editar producto">Editar</button>
                                    <button type="button" class="btn btn--sm delete-product-btn" data-product-id="${p.id}" aria-label="Eliminar producto">Borrar</button>
                                </div>
                            </div>
                        </article>
                    `;
                }).join('');

                return `
                    <section class="inventory-category-group">
                        <h3 class="inventory-category-group__title">${section.label}</h3>
                        <div class="inventory-category-group__grid">${itemsHtml}</div>
                    </section>
                `;
            }).join('')}
    `;
}

function handleProductImagePreview(event) {
    const form = event.target.closest('#product-form');
    if (!form || !['product-name', 'product-category', 'product-image-file'].includes(event.target.id)) return;
    updateProductImagePreview(form);
}

function handleInventoryUtilityClick(event) {
    if (event.target.closest('[data-close-product-modal]')) {
        closeModal();
        return;
    }

    if (event.target.closest('[data-show-low-stock]')) {
        switchTab('inventory');
        document.getElementById('inventory-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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

function renderPosGrid() {
    const grid = document.getElementById('pos-grid');
    const orderedCategories = [
        { key: 'refresco', label: 'Bebidas' },
        { key: 'mekato', label: 'Mekato' },
        { key: 'cerveza', label: 'Cerveza' },
        { key: 'otro', label: 'Otros' }
    ];
    const grouped = orderedCategories.map(section => ({
        ...section,
        items: products.filter(product => product.category === section.key)
    })).filter(section => section.items.length > 0);

    if (grouped.length === 0) {
        grid.innerHTML = '<div class="inventory-empty"><span aria-hidden="true">🛒</span><strong>No hay productos disponibles</strong><p>Agrega productos al catálogo para comenzar.</p></div>';
        return;
    }

    grid.innerHTML = `
        <div class="pos-category-groups">
            ${grouped.map(section => `
                <section class="pos-category-group">
                    <h3 class="pos-category-group__title">${section.label}</h3>
                    <div class="pos-category-group__grid">
                        ${section.items.map(product => {
                            const outOfStock = Number(product.stock) <= 0;
                            const lowStock = isLowStock(product);
                            return `
                                <button type="button" class="pos-product-card ${outOfStock ? 'pos-product-card--out-of-stock' : ''}"
                                        onclick="window.addToCart('${product.id}')"
                                        ${outOfStock ? 'disabled aria-disabled="true"' : ''}>
                                    <span class="pos-product-card__media">
                                        <img src="${getProductImage(product.name, product.category)}"
                                             alt="${escapeHtml(product.name)}" loading="lazy"
                                             onerror="this.onerror=null;this.src='img/productos/generico.svg'">
                                    </span>
                                    <span class="pos-product-card__body">
                                        <span class="pos-product-card__title">${escapeHtml(product.name)}</span>
                                        <span class="pos-product-card__price">${formatCurrency(product.price)}</span>
                                        <span class="pos-product-card__stock ${outOfStock ? 'is-empty' : lowStock ? 'is-low' : ''}">
                                            ${outOfStock ? 'Agotado' : `Stock: ${product.stock}`}
                                        </span>
                                    </span>
                                    <span class="pos-product-card__action">${outOfStock ? 'Sin stock' : '＋ Agregar'}</span>
                                    ${lowStock && !outOfStock ? '<span class="pos-product-card__warning">Stock bajo</span>' : ''}
                                </button>
                            `;
                        }).join('')}
                    </div>
                </section>
            `).join('')}
        </div>
    `;
}

function handlePosProductAnimation(event) {
    const productCard = event.target.closest('.pos-product-card:not(:disabled)');
    if (!productCard) return;
    productCard.classList.remove('pos-product-card--added');
    requestAnimationFrame(() => {
        productCard.classList.add('pos-product-card--added');
        window.setTimeout(() => productCard.classList.remove('pos-product-card--added'), 260);
    });
}

window.addToCart = (productId) => {
    const product = findProductById(productId);
    if (!product || Number(product.stock) <= 0) return;

    const existing = cart.find(item => String(item.product.id) === String(productId));
    if (existing) {
        if (existing.quantity >= Number(product.stock)) {
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
    const item = cart.find(cartItem => String(cartItem.product.id) === String(productId));
    if (!item) return;

    const newQuantity = item.quantity + delta;
    if (newQuantity <= 0) {
        cart = cart.filter(cartItem => String(cartItem.product.id) !== String(productId));
    } else if (newQuantity > Number(item.product.stock)) {
        showToast('No hay suficiente stock', 'error');
    } else {
        item.quantity = newQuantity;
    }
    updateCartUI();
};

window.removeFromCart = (productId) => {
    cart = cart.filter(item => String(item.product.id) !== String(productId));
    updateCartUI();
};

async function loadDailySalesSummary() {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const { data: sales, error: salesError } = await supabase
            .from('sales')
            .select('id, total, created_at')
            .gte('created_at', todayStart.toISOString())
            .lte('created_at', todayEnd.toISOString())
            .order('created_at', { ascending: false });

        if (salesError) throw salesError;

        const saleIds = (sales || []).map(sale => sale.id);
        let totalUnits = 0;
        const productSet = new Set();
        const totalRevenue = (sales || []).reduce((sum, sale) => sum + Number(sale.total || 0), 0);

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
                const name = productLookup[String(item.product_id)];
                if (name) productSet.add(name);
            });
        }

        document.getElementById('cart-day-products').textContent = String(productSet.size);
        document.getElementById('cart-day-qty').textContent = String(totalUnits);
        document.getElementById('cart-day-total').textContent = formatCurrency(totalRevenue);
    } catch (error) {
        console.error('Error loading daily sales summary:', error);
        showToast('Error al cargar el resumen de ventas del día', 'error');
    }
}

function updateCartUI() {
    const container = document.getElementById('cart-items');
    const summary = document.getElementById('cart-summary');

    if (cart.length === 0) {
        container.innerHTML = '<div class="cart-empty"><span aria-hidden="true">⚽</span><strong>Tu carrito está esperando</strong><p>Agrega productos para iniciar una venta.</p></div>';
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
        const total = cart.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);

        await loadProducts();
        for (const item of cart) {
            const currentProduct = products.find(product => String(product.id) === String(item.product.id));
            if (!currentProduct || Number(currentProduct.stock) < item.quantity) {
                showToast(`Stock insuficiente para ${item.product.name}`, 'error');
                return;
            }
        }

        const { data: saleData, error: saleError } = await supabase
            .from('sales')
            .insert([{ sold_by: user.id, total }])
            .select()
            .single();

        if (saleError) throw saleError;

        const saleItems = cart.map(item => ({
            sale_id: saleData.id,
            product_id: item.product.id,
            quantity: item.quantity,
            unit_price: item.product.price,
            subtotal: item.quantity * item.product.price
        }));
        const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
        if (itemsError) throw itemsError;

        showToast('Venta registrada exitosamente', 'success');
        cart = [];
        updateCartUI();
        await loadProducts();
        renderInventoryGrid();
        renderPosGrid();
        checkLowStock();
        await loadDailySalesSummary();
        await loadSalesHistory();
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
            tbody.innerHTML = '<tr><td colspan="6" class="inventory-history-empty"><span aria-hidden="true">📭</span><strong>No hay ventas en esta fecha</strong><span>Elige otro día para consultar el historial.</span></td></tr>';
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
