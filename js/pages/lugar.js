import { getCurrentUser, isAdmin } from '../auth.js';
import { supabase } from '../supabase.js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config.js';
import { escapeHtml, showConfirm, showToast } from '../ui.js';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const BUCKET = 'lugar';

let photos = [];
let pendingFiles = [];
let isUploading = false;
let isAdminView = false;
let activeUploadRequest = null;
let pageGeneration = 0;
let lightboxIndex = 0;
let removeLightboxKeys = null;
let removeRouteCleanup = null;
let previousFocus = null;
let previousBodyOverflow = '';

const pinIcon = `<svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>`;

function escapeAttribute(value) {
  return escapeHtml(String(value ?? '')).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function render() {
  return `
    <main class="page-container lugar-page">
      <header class="lugar-page__header">
        <p class="lugar-page__eyebrow">SUPERGOL · CONÓCENOS</p>
        <h1>LUGAR</h1>
        <p>Conoce el complejo y encuentra cómo llegar.</p>
      </header>
      <section id="lugar-admin" aria-label="Administración de Lugar"></section>
      <section class="lugar-address" aria-labelledby="lugar-address-title">
        <div class="lugar-address__content">
          <span class="lugar-address__icon">${pinIcon}</span>
          <div>
            <h2 id="lugar-address-title">Dirección</h2>
            <p id="lugar-address-text" class="lugar-address__text lugar-address__empty">Cargando dirección...</p>
          </div>
        </div>
        <a id="lugar-directions" class="btn btn--primary" href="#" target="_blank" rel="noopener noreferrer" hidden>Cómo llegar</a>
        <div id="lugar-address-admin"></div>
      </section>
      <section aria-label="Fotos del complejo">
        <div id="lugar-gallery" class="lugar-gallery" aria-live="polite">
          <div class="lugar-loading" role="status"><span class="lugar-loading__ball" aria-hidden="true">⚽</span><span>Cargando fotos del complejo...</span></div>
        </div>
      </section>
    </main>
  `;
}

export async function init() {
  pageGeneration += 1;
  removeRouteCleanup?.();
  activeUploadRequest?.abort();
  activeUploadRequest = null;
  if (document.getElementById('lugar-lightbox')) closeLightbox();
  pendingFiles.forEach(entry => URL.revokeObjectURL(entry.preview));
  const user = await getCurrentUser();
  isAdminView = isAdmin(user);
  photos = [];
  pendingFiles = [];
  isUploading = false;
  document.getElementById('lugar-admin').innerHTML = isAdminView ? renderAdminControls() : '';
  const cleanupOnNavigate = () => {
    if (window.location.hash === '#/lugar') return;
    pageGeneration += 1;
    activeUploadRequest?.abort();
    if (document.getElementById('lugar-lightbox')) closeLightbox();
    pendingFiles.forEach(entry => URL.revokeObjectURL(entry.preview));
    pendingFiles = [];
    removeRouteCleanup?.();
    removeRouteCleanup = null;
  };
  window.addEventListener('hashchange', cleanupOnNavigate);
  removeRouteCleanup = () => window.removeEventListener('hashchange', cleanupOnNavigate);

  const { data: photoRows, error: photosError } = await supabase
    .from('lugar_fotos')
    .select('id, url, storage_path, descripcion, orden, created_at')
    .order('orden', { ascending: true })
    .order('created_at', { ascending: true });
  const { data: infoRows, error: infoError } = await supabase
    .from('lugar_info')
    .select('direccion')
    .eq('id', 1)
    .maybeSingle();

  if (photosError || infoError) {
    const message = [photosError?.message, infoError?.message].filter(Boolean).join(' · ');
    console.error('Error al cargar Lugar:', message);
    document.getElementById('lugar-gallery').innerHTML = `<div class="lugar-error" role="alert">No se pudo cargar la información del lugar. ${escapeHtml(message)}</div>`;
    document.getElementById('lugar-address-text').textContent = 'No se pudo cargar la dirección.';
    showToast('No se pudo cargar la información de Lugar', 'error');
    return;
  }

  photos = photoRows || [];
  renderAddress(infoRows?.direccion || '', isAdminView);
  renderGallery();
  if (isAdminView) bindAdminControls();
}

function renderAdminControls() {
  return `
    <section class="lugar-admin" aria-labelledby="lugar-admin-title">
      <div class="lugar-admin__heading">
        <h2 id="lugar-admin-title">Administrar fotos</h2>
        <p>Sube imágenes JPG, PNG o WEBP de hasta 5 MB cada una.</p>
      </div>
      <input id="lugar-file-input" class="lugar-file-input" type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label="Seleccionar fotos del complejo">
      <div id="lugar-upload-zone" class="lugar-upload-zone">
        <span class="lugar-upload-zone__icon" aria-hidden="true">⇧</span>
        <strong>Arrastra tus fotos aquí</strong>
        <span class="lugar-upload-zone__hint">También puedes elegir varios archivos desde tu dispositivo.</span>
        <div class="lugar-upload-zone__actions">
          <button id="lugar-add-photos" type="button" class="btn btn--secondary">Agregar fotos</button>
          <button id="lugar-upload-photos" type="button" class="btn btn--primary" hidden disabled>Subir fotos</button>
        </div>
      </div>
      <p id="lugar-upload-message" class="lugar-upload-message" role="status" aria-live="polite"></p>
      <div id="lugar-pending" class="lugar-pending"></div>
    </section>
  `;
}

function renderAddress(address, admin) {
  const addressText = document.getElementById('lugar-address-text');
  const directions = document.getElementById('lugar-directions');
  addressText.textContent = address || 'Pronto compartiremos la dirección de nuestro lugar.';
  addressText.classList.toggle('lugar-address__empty', !address);
  if (address) {
    directions.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    directions.hidden = false;
  } else {
    directions.hidden = true;
  }
  document.getElementById('lugar-address-admin').innerHTML = admin ? `
    <form id="lugar-address-form" class="lugar-address__admin">
      <div class="form-group">
        <label class="form-label" for="lugar-address-input">Editar dirección</label>
        <input id="lugar-address-input" class="form-input" type="text" maxlength="500" value="${escapeAttribute(address)}" placeholder="Escribe la dirección del complejo">
      </div>
      <button class="btn btn--secondary" type="submit">Guardar dirección</button>
    </form>
  ` : '';

  const addressForm = document.getElementById('lugar-address-form');
  if (addressForm) {
    addressForm.addEventListener('submit', saveAddress);
  }
}

function renderGallery() {
  const gallery = document.getElementById('lugar-gallery');
  if (!photos.length) {
    gallery.innerHTML = `<div class="lugar-empty"><span class="lugar-empty__icon" aria-hidden="true">⚽</span><strong>Pronto compartiremos fotos de nuestro lugar</strong><span>Vuelve pronto para conocer el complejo.</span></div>`;
    return;
  }

  gallery.innerHTML = photos.map((photo, index) => `
    <article class="lugar-photo">
      <button type="button" class="lugar-photo__open" data-photo-index="${index}" aria-label="Ampliar foto ${index + 1}: ${escapeAttribute(photo.descripcion || 'Complejo Super Gol')}">
        <img class="lugar-photo__image" src="${escapeAttribute(photo.url)}" alt="${escapeAttribute(photo.descripcion || 'Foto del complejo Super Gol')}" loading="lazy">
      </button>
      ${photo.descripcion ? `<p class="lugar-photo__caption">${escapeHtml(photo.descripcion)}</p>` : ''}
      ${isAdminView ? `
        <div class="lugar-photo__admin">
          <label class="sr-only" for="lugar-caption-${escapeAttribute(photo.id)}">Descripción de la foto</label>
          <input id="lugar-caption-${escapeAttribute(photo.id)}" class="form-input" type="text" maxlength="250" value="${escapeAttribute(photo.descripcion || '')}" placeholder="Descripción opcional">
          <button type="button" class="btn btn--secondary" data-save-caption="${escapeAttribute(photo.id)}">Guardar</button>
          <button type="button" class="btn btn--danger" data-delete-photo="${escapeAttribute(photo.id)}">Borrar</button>
        </div>
      ` : ''}
    </article>
  `).join('');

  gallery.querySelectorAll('[data-photo-index]').forEach(button => {
    button.addEventListener('click', () => openLightbox(Number(button.dataset.photoIndex), button));
  });
  gallery.querySelectorAll('[data-save-caption]').forEach(button => {
    button.addEventListener('click', () => saveCaption(button.dataset.saveCaption));
  });
  gallery.querySelectorAll('[data-delete-photo]').forEach(button => {
    button.addEventListener('click', () => deletePhoto(button.dataset.deletePhoto));
  });
}

function bindAdminControls() {
  const fileInput = document.getElementById('lugar-file-input');
  const zone = document.getElementById('lugar-upload-zone');
  const addButton = document.getElementById('lugar-add-photos');
  const uploadButton = document.getElementById('lugar-upload-photos');

  addButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    queueFiles(fileInput.files);
    fileInput.value = '';
  });
  zone.addEventListener('dragover', event => {
    event.preventDefault();
    zone.classList.add('lugar-upload-zone--active');
  });
  zone.addEventListener('dragleave', event => {
    if (!zone.contains(event.relatedTarget)) zone.classList.remove('lugar-upload-zone--active');
  });
  zone.addEventListener('drop', event => {
    event.preventDefault();
    zone.classList.remove('lugar-upload-zone--active');
    queueFiles(event.dataTransfer.files);
  });
  uploadButton.addEventListener('click', uploadPendingFiles);
  renderPendingFiles();
}

function queueFiles(fileList) {
  const message = document.getElementById('lugar-upload-message');
  const errors = [];
  for (const file of fileList) {
    if (!ALLOWED_TYPES.has(file.type)) {
      errors.push(`${file.name}: usa JPG, PNG o WEBP.`);
      continue;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      errors.push(`${file.name}: supera el máximo de 5 MB.`);
      continue;
    }
    pendingFiles.push({ file, preview: URL.createObjectURL(file), progress: 0 });
  }
  message.textContent = errors.join(' ');
  if (errors.length) showToast(errors.join(' '), 'error', 6000);
  renderPendingFiles();
}

function renderPendingFiles() {
  const pendingContainer = document.getElementById('lugar-pending');
  const uploadButton = document.getElementById('lugar-upload-photos');
  const addButton = document.getElementById('lugar-add-photos');
  if (!pendingContainer || !uploadButton || !addButton) return;
  pendingContainer.innerHTML = pendingFiles.map((entry, index) => `
    <div class="lugar-pending__item">
      <img src="${escapeAttribute(entry.preview)}" alt="Vista previa de ${escapeAttribute(entry.file.name)}">
      <span class="lugar-pending__name" title="${escapeAttribute(entry.file.name)}">${escapeHtml(entry.file.name)}</span>
      <button type="button" class="btn btn--secondary btn--sm" data-remove-pending="${index}" aria-label="Quitar ${escapeAttribute(entry.file.name)}">×</button>
      <progress class="lugar-progress" max="100" value="${entry.progress}" aria-label="Progreso de subida de ${escapeAttribute(entry.file.name)}"></progress>
    </div>
  `).join('');
  uploadButton.hidden = pendingFiles.length === 0;
  uploadButton.disabled = isUploading || pendingFiles.length === 0;
  addButton.disabled = isUploading;
  document.getElementById('lugar-pending').querySelectorAll('[data-remove-pending]').forEach(button => {
    button.disabled = isUploading;
    button.addEventListener('click', () => {
      URL.revokeObjectURL(pendingFiles[Number(button.dataset.removePending)].preview);
      pendingFiles.splice(Number(button.dataset.removePending), 1);
      renderPendingFiles();
    });
  });
}

async function uploadPendingFiles() {
  if (isUploading || !pendingFiles.length) return;
  const uploadGeneration = pageGeneration;
  isUploading = true;
  const uploadButton = document.getElementById('lugar-upload-photos');
  const addButton = document.getElementById('lugar-add-photos');
  uploadButton.disabled = true;
  addButton.disabled = true;
  document.getElementById('lugar-upload-message').textContent = 'Subiendo fotos...';
  let uploaded = 0;
  let nextOrder = photos.reduce((max, photo) => Math.max(max, Number(photo.orden) || 0), 0);

  while (pendingFiles.length && uploadGeneration === pageGeneration) {
    const entry = pendingFiles[0];
    try {
      const path = createStoragePath(entry.file);
      await uploadFile(path, entry.file, progress => {
        entry.progress = progress;
        const progressBar = document.querySelector(`.lugar-pending__item .lugar-progress`);
        if (progressBar) progressBar.value = progress;
      });
      if (uploadGeneration !== pageGeneration) {
        const cleanup = await supabase.storage.from(BUCKET).remove([path]);
        if (cleanup.error) console.error('No se pudo limpiar una foto tras salir de Lugar:', cleanup.error);
        return;
      }
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const { error } = await supabase.from('lugar_fotos').insert({
        url: urlData.publicUrl,
        storage_path: path,
        descripcion: '',
        orden: ++nextOrder
      });
      if (error) {
        const cleanup = await supabase.storage.from(BUCKET).remove([path]);
        if (cleanup.error) throw new Error(`No se pudo guardar el registro (${error.message}) ni limpiar el archivo (${cleanup.error.message}).`);
        throw error;
      }
      if (uploadGeneration !== pageGeneration) return;
      uploaded += 1;
      URL.revokeObjectURL(entry.preview);
      pendingFiles.shift();
      renderPendingFiles();
    } catch (error) {
      console.error('Error al subir foto:', error);
      if (uploadGeneration === pageGeneration && document.getElementById('lugar-upload-message')) {
        showToast(`No se pudo subir ${entry.file.name}: ${error.message || 'error desconocido'}`, 'error', 6000);
      }
      break;
    }
  }

  if (uploadGeneration !== pageGeneration) return;
  isUploading = false;
  renderPendingFiles();
  if (uploaded) {
    if (document.getElementById('lugar-upload-message')) {
      showToast(`${uploaded} foto${uploaded === 1 ? '' : 's'} guardada${uploaded === 1 ? '' : 's'} correctamente`, 'success');
    }
    await reloadPhotos();
  }
  const uploadMessage = document.getElementById('lugar-upload-message');
  if (uploadMessage) {
    uploadMessage.textContent = pendingFiles.length
      ? 'Quedaron archivos pendientes; puedes volver a intentar la subida.'
      : '';
  }
}

function createStoragePath(file) {
  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
  const randomId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${Date.now()}-${randomId}.${extension}`;
}

async function uploadFile(path, file, onProgress) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error('Inicia sesión de nuevo para subir fotos.');

  await new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    activeUploadRequest = request;
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    request.open('POST', `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodedPath}`);
    request.setRequestHeader('apikey', SUPABASE_ANON_KEY);
    request.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    request.setRequestHeader('Content-Type', file.type);
    request.setRequestHeader('x-upsert', 'false');
    request.upload.addEventListener('progress', event => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener('load', () => {
      activeUploadRequest = null;
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
        return;
      }
      let message = request.responseText;
      if (request.getResponseHeader('Content-Type')?.includes('application/json')) {
        try {
          const response = JSON.parse(request.responseText);
          message = response.message || response.error || message;
        } catch (parseError) {
          console.error('Respuesta JSON inválida al subir foto:', parseError);
          reject(new Error('El servicio de almacenamiento respondió con un error ilegible.'));
          return;
        }
      }
      reject(new Error(message || `Error HTTP ${request.status}`));
    });
    request.addEventListener('abort', () => {
      activeUploadRequest = null;
      reject(new Error('La subida fue cancelada.'));
    });
    request.addEventListener('error', () => {
      activeUploadRequest = null;
      reject(new Error('Error de red al subir la imagen.'));
    });
    request.send(file);
  });
}

async function reloadPhotos() {
  const { data, error } = await supabase
    .from('lugar_fotos')
    .select('id, url, storage_path, descripcion, orden, created_at')
    .order('orden', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) {
    showToast(`Las fotos se guardaron, pero no se pudo actualizar la galería: ${error.message}`, 'error', 6000);
    return;
  }
  photos = data || [];
  if (document.getElementById('lugar-gallery')) renderGallery();
}

async function saveAddress(event) {
  event.preventDefault();
  const input = document.getElementById('lugar-address-input');
  const address = input.value.trim();
  if (address.length > 500) {
    showToast('La dirección no puede superar 500 caracteres.', 'error');
    return;
  }
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  const { error } = await supabase.from('lugar_info').upsert(
    { id: 1, direccion: address, updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  );
  button.disabled = false;
  if (error) {
    console.error('Error al guardar dirección:', error);
    showToast(`No se pudo guardar la dirección: ${error.message}`, 'error', 6000);
    return;
  }
  renderAddress(address, true);
  showToast('Dirección guardada correctamente', 'success');
}

async function saveCaption(id) {
  const photo = photos.find(item => String(item.id) === String(id));
  const input = document.getElementById(`lugar-caption-${id}`);
  if (!photo || !input) return;
  const button = input.parentElement.querySelector('[data-save-caption]');
  button.disabled = true;
  const { error } = await supabase.from('lugar_fotos').update({ descripcion: input.value.trim() }).eq('id', id);
  button.disabled = false;
  if (error) {
    console.error('Error al guardar pie de foto:', error);
    showToast(`No se pudo guardar la descripción: ${error.message}`, 'error', 6000);
    return;
  }
  showToast('Descripción guardada', 'success');
  await reloadPhotos();
}

async function deletePhoto(id) {
  const photo = photos.find(item => String(item.id) === String(id));
  if (!photo) return;
  const confirmed = await showConfirm('Borrar foto', 'Se eliminarán la foto y su registro. Esta acción no se puede deshacer.');
  if (!confirmed) return;

  const { error: rowError } = await supabase.from('lugar_fotos').delete().eq('id', id);
  if (rowError) {
    console.error('Error al borrar registro de foto:', rowError);
    showToast(`No se pudo borrar el registro: ${rowError.message}`, 'error', 6000);
    return;
  }
  const { error: fileError } = await supabase.storage.from(BUCKET).remove([photo.storage_path]);
  if (fileError) {
    console.error('Error al borrar archivo del bucket:', fileError);
    showToast(`Se borró el registro, pero no el archivo del bucket: ${fileError.message}`, 'error', 7000);
    await reloadPhotos();
    return;
  }
  showToast('Foto borrada correctamente', 'success');
  await reloadPhotos();
}

function openLightbox(index, trigger) {
  if (!photos.length) return;
  lightboxIndex = index;
  previousFocus = trigger;
  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  renderLightbox();
}

function renderLightbox() {
  document.getElementById('lugar-lightbox')?.remove();
  const photo = photos[lightboxIndex];
  const overlay = document.createElement('div');
  overlay.id = 'lugar-lightbox';
  overlay.className = 'lugar-lightbox';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', `Foto ${lightboxIndex + 1} de ${photos.length}`);
  overlay.innerHTML = `
    <button type="button" class="lugar-lightbox__button" data-lightbox-prev aria-label="Foto anterior" ${photos.length < 2 ? 'disabled' : ''}>‹</button>
    <figure class="lugar-lightbox__figure">
      <img class="lugar-lightbox__image" src="${escapeAttribute(photo.url)}" alt="${escapeAttribute(photo.descripcion || 'Foto del complejo Super Gol')}">
      ${photo.descripcion ? `<figcaption class="lugar-lightbox__caption">${escapeHtml(photo.descripcion)}</figcaption>` : `<figcaption class="lugar-lightbox__caption">${lightboxIndex + 1} / ${photos.length}</figcaption>`}
    </figure>
    <button type="button" class="lugar-lightbox__button" data-lightbox-next aria-label="Foto siguiente" ${photos.length < 2 ? 'disabled' : ''}>›</button>
    <button type="button" class="lugar-lightbox__button lugar-lightbox__close" data-lightbox-close aria-label="Cerrar visor">×</button>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', event => {
    if (event.target === overlay) closeLightbox();
  });
  overlay.querySelector('[data-lightbox-close]').addEventListener('click', closeLightbox);
  overlay.querySelector('[data-lightbox-prev]').addEventListener('click', () => {
    lightboxIndex = (lightboxIndex - 1 + photos.length) % photos.length;
    renderLightbox();
  });
  overlay.querySelector('[data-lightbox-next]').addEventListener('click', () => {
    lightboxIndex = (lightboxIndex + 1) % photos.length;
    renderLightbox();
  });
  const keyHandler = event => {
    if (event.key === 'Escape') closeLightbox();
    if (event.key === 'ArrowLeft' && photos.length > 1) {
      lightboxIndex = (lightboxIndex - 1 + photos.length) % photos.length;
      renderLightbox();
    }
    if (event.key === 'ArrowRight' && photos.length > 1) {
      lightboxIndex = (lightboxIndex + 1) % photos.length;
      renderLightbox();
    }
  };
  if (removeLightboxKeys) removeLightboxKeys();
  document.addEventListener('keydown', keyHandler);
  removeLightboxKeys = () => document.removeEventListener('keydown', keyHandler);
  overlay.querySelector('[data-lightbox-close]').focus();
}

function closeLightbox() {
  document.getElementById('lugar-lightbox')?.remove();
  if (removeLightboxKeys) removeLightboxKeys();
  removeLightboxKeys = null;
  document.body.style.overflow = previousBodyOverflow;
  previousFocus?.focus();
  previousFocus = null;
}
