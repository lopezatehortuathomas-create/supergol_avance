export function renderProductForm(product = null) {
    return `
        <form id="product-form" class="space-y-4">
            <div class="form-group">
                <label class="form-label" for="product-name">Nombre</label>
                <input type="text" id="product-name" class="form-input" required 
                       value="${product ? product.name : ''}">
            </div>
            <div class="form-group">
                <label class="form-label" for="product-category">Categoría</label>
                <select id="product-category" class="form-input" required>
                    <option value="refresco" ${product?.category === 'refresco' ? 'selected' : ''}>Refresco</option>
                    <option value="mekato" ${product?.category === 'mekato' ? 'selected' : ''}>Mekato</option>
                    <option value="cerveza" ${product?.category === 'cerveza' ? 'selected' : ''}>Cerveza</option>
                    <option value="otro" ${product?.category === 'otro' ? 'selected' : ''}>Otro</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label" for="product-price">Precio ($)</label>
                <input type="number" id="product-price" class="form-input" required min="0" step="100"
                       value="${product ? product.price : ''}">
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div class="form-group">
                    <label class="form-label" for="product-stock">Stock Actual</label>
                    <input type="number" id="product-stock" class="form-input" required min="0"
                           value="${product ? product.stock : '0'}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="product-min-stock">Stock Mínimo</label>
                    <input type="number" id="product-min-stock" class="form-input" required min="0"
                           value="${product ? product.min_stock : '5'}">
                </div>
            </div>
        </form>
    `;
}

export function getProductFormData(formElement) {
    if (!formElement.checkValidity()) {
        formElement.reportValidity();
        return null;
    }

    return {
        name: document.getElementById('product-name').value.trim(),
        category: document.getElementById('product-category').value,
        price: parseFloat(document.getElementById('product-price').value),
        stock: parseInt(document.getElementById('product-stock').value, 10),
        min_stock: parseInt(document.getElementById('product-min-stock').value, 10)
    };
}
