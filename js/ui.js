// Muestra una notificación toast
export function showToast(message, type = 'success', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerText = message;
  
  container.appendChild(toast);

  // Animación de entrada (asumiendo CSS para ello)
  requestAnimationFrame(() => {
    toast.classList.add('toast--show');
  });

  setTimeout(() => {
    toast.remove();
  }, duration);
}

// Muestra un modal
export function showModal(title, bodyHTML, footerHTML = '') {
  let container = document.getElementById('modal-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'modal-container';
    document.body.appendChild(container);
  }

  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';
  
  modalContent.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">${escapeHtml(title)}</h3>
      <button class="modal-close">&times;</button>
    </div>
    <div class="modal-body">${bodyHTML}</div>
    ${typeof footerHTML === 'function' ? '<div class="modal-footer"><button class="btn btn--primary" id="modal-submit">Guardar</button></div>' : footerHTML ? `<div class="modal-footer">${footerHTML}</div>` : ''}
  `;

  modalOverlay.appendChild(modalContent);
  container.appendChild(modalOverlay);

  const closeBtn = modalContent.querySelector('.modal-close');
  const closeFn = () => {
    modalOverlay.remove();
    document.removeEventListener('keydown', keydownFn);
  };

  closeBtn.addEventListener('click', closeFn);
  if (typeof footerHTML === 'function') {
    modalContent.querySelector('#modal-submit').addEventListener('click', async () => {
      const completed = await footerHTML();
      if (completed) closeFn();
    });
  }
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeFn();
  });

  const keydownFn = (e) => {
    if (e.key === 'Escape') closeFn();
  };
  document.addEventListener('keydown', keydownFn);

  return modalOverlay;
}

// Muestra un diálogo de confirmación
export function showConfirm(title, message, onConfirm = null) {
  if (typeof message === 'function') {
    onConfirm = message;
    message = '¿Deseas continuar?';
  }
  return new Promise((resolve) => {
    const footerHTML = `
      <button class="btn btn--secondary" id="confirm-cancel">Cancelar</button>
      <button class="btn btn--primary" id="confirm-ok">Confirmar</button>
    `;
    const modal = showModal(title, `<p>${escapeHtml(message)}</p>`, footerHTML);
    
    modal.querySelector('#confirm-ok').addEventListener('click', async () => {
      closeModal();
      resolve(true);
      if (onConfirm) await onConfirm();
    });
    modal.querySelector('#confirm-cancel').addEventListener('click', () => {
      closeModal();
      resolve(false);
    });
  });
}

// Cierra cualquier modal abierto
export function closeModal() {
  const container = document.getElementById('modal-container');
  if (container) {
    container.innerHTML = '';
  }
}

// Controla el overlay de carga
export function setLoading(isLoading) {
  const loader = document.getElementById('loader');
  if (loader) {
    loader.style.display = isLoading ? 'flex' : 'none';
  }
}

// Formatea fecha a DD/MM/YYYY HH:mm
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).format(date);
}

// Formatea moneda a Pesos Colombianos
export function formatCurrency(amount) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  }).format(amount);
}

// Escapa HTML para prevenir XSS
export function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Renderiza un badge de estado
export function renderBadge(status) {
  const map = {
    'pendiente':  'badge--pendiente',
    'aprobada':   'badge--aprobada',
    'rechazada':  'badge--rechazada',
    'cancelada':  'badge--cancelada',
    'completada': 'badge--completada',
    'activo':     'badge--aprobada',
    'inactivo':   'badge--cancelada',
  };
  const badgeClass = map[status?.toLowerCase()] || 'badge--pendiente';
  return `<span class="badge ${badgeClass}">${escapeHtml(status || '')}</span>`;
}
