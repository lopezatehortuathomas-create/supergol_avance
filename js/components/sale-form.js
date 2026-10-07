import { formatCurrency, escapeHtml } from '../ui.js';
import { getProductImage } from './product-form.js';

export function renderCartItem(item) {
    const subtotal = item.quantity * item.product.price;
    return `
        <div class="cart-item" data-product-id="${item.product.id}">
            <img class="cart-item__image" src="${getProductImage(item.product.name, item.product.category)}" alt="${escapeHtml(item.product.name)}" loading="lazy"
                 onerror="this.onerror=null;this.src='img/productos/generico.svg'">
            <div class="cart-item__content">
                <div class="cart-item__heading">
                    <span class="cart-item__name">${escapeHtml(item.product.name)}</span>
                    <button class="cart-item__remove" aria-label="Quitar ${escapeHtml(item.product.name)}" onclick="window.removeFromCart('${item.product.id}')">✕</button>
                </div>
                <div class="cart-item__prices">
                    <span>${formatCurrency(item.product.price)} c/u</span>
                    <strong>${formatCurrency(subtotal)}</strong>
                </div>
                <div class="cart-item__quantity">
                    <button class="btn btn--sm cart-quantity-btn" aria-label="Restar una unidad" onclick="window.updateCartQuantity('${item.product.id}', -1)">−</button>
                    <span>${item.quantity}</span>
                    <button class="btn btn--sm cart-quantity-btn" aria-label="Agregar una unidad" onclick="window.updateCartQuantity('${item.product.id}', 1)">＋</button>
                </div>
            </div>
        </div>
    `;
}

export function renderCartSummary(items) {
    const total = items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    return `
        <div class="cart-total">
            <span>Total</span>
            <strong>${formatCurrency(total)}</strong>
        </div>
        <button id="btn-checkout" class="btn btn--primary btn--lg w-full">Registrar Venta</button>
    `;
}
