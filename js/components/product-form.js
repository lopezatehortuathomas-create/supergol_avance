import { escapeHtml } from '../ui.js';

const PRODUCT_IMAGE_MAP = [
    { keywords: ['agua', 'cristal', 'brisa', 'manantial'], image: 'img/productos/agua.svg' },
    { keywords: ['gatorade', 'isotonica', 'hidratante'], image: 'img/productos/isotonica.svg' },
    { keywords: ['jugo', 'hit', 'nectar'], image: 'img/productos/jugo.svg' },
    { keywords: ['coca', 'coke', 'pepsi', 'gaseosa', 'colombiana', 'pony'], image: 'img/productos/bebida.svg' },
    { keywords: ['cerveza', 'aguila', 'águila', 'poker', 'póker', 'club', 'corona'], image: 'img/productos/cerveza.svg' },
    { keywords: ['chocoramo', 'chocorramo', 'ponque', 'pastel'], image: 'img/productos/ponque.svg' },
    { keywords: ['doritos', 'papas', 'margarita', 'mekato', 'galleta', 'snack'], image: 'img/productos/mekato.svg' }
];

const CATEGORY_IMAGES = {
    refresco: 'img/productos/bebida.svg',
    cerveza: 'img/productos/cerveza.svg',
    mekato: 'img/productos/mekato.svg',
    otro: 'img/productos/generico.svg'
};

function normalizeProductText(value = '') {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('es');
}

export function getProductImage(name, category) {
    const normalizedName = normalizeProductText(name);
    const match = PRODUCT_IMAGE_MAP.find(entry =>
        entry.keywords.some(keyword => normalizedName.includes(normalizeProductText(keyword)))
    );

    return match?.image || CATEGORY_IMAGES[category] || CATEGORY_IMAGES.otro;
}

export function renderProductForm(product = null) {
    return `
        <form id="product-form" class="space-y-4 product-form">
            <div class="form-group">
                <label class="form-label" for="product-name">Nombre</label>
                <input type="text" id="product-name" class="form-input" required 
                       value="${product ? escapeHtml(product.name) : ''}">
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
                <input type="number" id="product-price" class="form-input" required min="0" step="0.01"
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
            <fieldset class="product-image-field">
                <legend class="form-label">Imagen del producto</legend>
                <div class="product-image-editor">
                    <div class="product-image-preview-wrap">
                        <img id="product-image-preview" class="product-image-preview"
                             src="${getProductImage(product?.name || '', product?.category || 'otro')}"
                             alt="Vista previa de ${escapeHtml(product?.name || 'producto')}" loading="lazy"
                             onerror="this.onerror=null;this.src='img/productos/generico.svg'">
                    </div>
                    <div class="product-image-fields">
                        <label class="form-label" for="product-image-file">Subir JPG, PNG o WEBP</label>
                        <input type="file" id="product-image-file" class="form-input"
                               accept="image/jpeg,image/png,image/webp">
                        <p id="product-image-status" class="product-image-status" aria-live="polite">
                            La imagen se previsualiza en este formulario; se usa la ilustración local del catálogo.
                        </p>
                    </div>
                </div>
            </fieldset>
            <div class="product-form__actions">
                <button type="button" class="btn btn--secondary" data-close-product-modal>Cancelar</button>
            </div>
        </form>
    `;
}

let activePreviewUrl = null;

export function updateProductImagePreview(form) {
    const nameInput = form.querySelector('#product-name');
    const categoryInput = form.querySelector('#product-category');
    const fileInput = form.querySelector('#product-image-file');
    const preview = form.querySelector('#product-image-preview');
    const status = form.querySelector('#product-image-status');
    if (!nameInput || !categoryInput || !fileInput || !preview || !status) return;

    const file = fileInput.files?.[0];
    if (file) {
        const supportedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!supportedTypes.includes(file.type)) {
            fileInput.value = '';
            status.textContent = 'Formato no compatible. Usa JPG, PNG o WEBP.';
            status.classList.add('is-error');
            updateProductImagePreview(form);
            return;
        }
        if (activePreviewUrl) URL.revokeObjectURL(activePreviewUrl);
        activePreviewUrl = URL.createObjectURL(file);
        preview.src = activePreviewUrl;
        status.textContent = 'Vista previa del archivo seleccionado. No se guardará en la base de datos.';
        status.classList.remove('is-error');
    } else {
        if (activePreviewUrl) URL.revokeObjectURL(activePreviewUrl);
        activePreviewUrl = null;
        preview.src = getProductImage(nameInput.value, categoryInput.value);
        status.textContent = 'Imagen sugerida automáticamente. La ilustración local se utiliza en el catálogo.';
        status.classList.remove('is-error');
    }

    preview.alt = `Vista previa de ${nameInput.value.trim() || 'producto'}`;
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
