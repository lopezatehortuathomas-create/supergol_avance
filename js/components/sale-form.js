import { formatCurrency, escapeHtml } from '../ui.js';

export function renderCartItem(item) {
    const subtotal = item.quantity * item.product.price;
    return `
        <div class="p-3 flex flex-col gap-2 border-b last:border-b-0" data-product-id="${item.product.id}">
            <div class="flex justify-between items-start">
                <span class="font-bold text-sm">${escapeHtml(item.product.name)}</span>
                <button class="text-red-500 hover:text-red-700 text-sm" onclick="window.removeFromCart('${item.product.id}')">✕</button>
            </div>
            <div class="flex justify-between items-center text-sm">
                <span class="text-gray-600">${formatCurrency(item.product.price)} c/u</span>
                <span class="font-bold">${formatCurrency(subtotal)}</span>
            </div>
            <div class="flex items-center gap-2 mt-1">
                <button class="btn btn--sm bg-gray-200" onclick="window.updateCartQuantity('${item.product.id}', -1)">-</button>
                <span class="w-8 text-center font-bold">${item.quantity}</span>
                <button class="btn btn--sm bg-gray-200" onclick="window.updateCartQuantity('${item.product.id}', 1)">+</button>
            </div>
        </div>
    `;
}

export function renderCartSummary(items) {
    const total = items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    return `
        <div class="flex justify-between items-center mb-4">
            <span class="text-lg font-bold">Total:</span>
            <span class="text-2xl font-bold text-green-700">${formatCurrency(total)}</span>
        </div>
        <button id="btn-checkout" class="btn btn--primary btn--lg w-full">Registrar Venta</button>
    `;
}
