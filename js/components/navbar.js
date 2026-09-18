import { isAdmin, signOut } from '../auth.js';
import { navigateTo } from '../router.js';
import { escapeHtml } from '../ui.js';

export function render(user) {
  if (!user) return '';

  const adminNav = isAdmin(user) ? `
    <div class="sidebar-divider"></div>
    <div class="sidebar-section">Administración</div>
    <a href="#/admin" class="nav-link" data-path="#/admin">📊 Dashboard</a>
    <a href="#/admin/reservas" class="nav-link" data-path="#/admin/reservas">✅ Gestión Reservas</a>
    <a href="#/admin/usos" class="nav-link" data-path="#/admin/usos">📝 Registro de Usos</a>
    <a href="#/admin/inventario" class="nav-link" data-path="#/admin/inventario">📦 Inventario</a>
    <a href="#/admin/reportes" class="nav-link" data-path="#/admin/reportes">📈 Reportes</a>
  ` : '';

  const userName = user.user_metadata?.full_name || user.email || 'Usuario';

  return `
    <nav class="sidebar">
      <div class="sidebar-header">
        <h2 class="sidebar-logo"><span aria-hidden="true">⚽</span> SUPERGOL</h2>
        <button id="mobile-menu-close" class="mobile-menu-close" aria-label="Cerrar menú">&times;</button>
      </div>
      
      <div class="sidebar-user">
        <div class="sidebar-user-avatar">👤</div>
        <div class="sidebar-user-info">
          <p class="sidebar-user-greeting">Sesión activa</p>
          <p class="sidebar-user-name" title="${escapeHtml(userName)}">${escapeHtml(userName)}</p>
        </div>
      </div>

      <div class="sidebar-nav">
        <a href="#/" class="nav-link" data-path="#/"><span>⌂</span> Inicio</a>
        <a href="#/reservar" class="nav-link" data-path="#/reservar"><span>▣</span> Reservar</a>
        <a href="#/mis-reservas" class="nav-link" data-path="#/mis-reservas"><span>≡</span> Mis Reservas</a>
        <a href="#/guia" class="nav-link" data-path="#/guia"><span>?</span> Manual de usuario</a>
        
        ${adminNav}
        
        <div class="sidebar-divider"></div>
        <a href="#" id="btn-logout" class="nav-link text-danger">🚪 Cerrar Sesión</a>
      </div>
    </nav>
    <button id="mobile-menu-toggle" class="mobile-menu-toggle" aria-label="Abrir menú">☰</button>
  `;
}

export function init() {
  const currentHash = window.location.hash || '#/';
  
  // Marcar enlace activo
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('data-path') === currentHash) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Logout
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async (e) => {
      e.preventDefault();
      await signOut();
      navigateTo('#/login');
    });
  }

  // Toggle menú móvil
  const toggleBtn = document.getElementById('mobile-menu-toggle');
  const closeBtn = document.getElementById('mobile-menu-close');
  const sidebar = document.querySelector('.sidebar');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.add('sidebar--open');
    });
  }

  if (closeBtn && sidebar) {
    closeBtn.addEventListener('click', () => {
      sidebar.classList.remove('sidebar--open');
    });
  }
}
