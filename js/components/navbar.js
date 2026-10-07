import { isAdmin, signOut } from '../auth.js';
import { navigateTo } from '../router.js';
import { escapeHtml } from '../ui.js';

export function render(user) {
  if (!user) return '';

  const adminNav = isAdmin(user) ? `
    <div class="sidebar-divider"></div>
    <div class="sidebar-section">Administración</div>
    <a href="#/admin" class="nav-link" data-path="#/admin"><span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="5" rx="1"/><rect x="13" y="10" width="8" height="11" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/></svg></span>Dashboard</a>
    <a href="#/admin/reservas" class="nav-link" data-path="#/admin/reservas"><span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h3M8 17h7"/></svg></span>Gestión Reservas</a>
    <a href="#/admin/usos" class="nav-link" data-path="#/admin/usos"><span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 3h8l4 4v14H4V3h4ZM8 3v5h8V3M8 13h8M8 17h5"/></svg></span>Registro de Usos</a>
    <a href="#/admin/inventario" class="nav-link" data-path="#/admin/inventario"><span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m3 7 9-4 9 4-9 4-9-4ZM3 7v10l9 4 9-4V7M12 11v10"/></svg></span>Inventario</a>
    <a href="#/admin/reportes" class="nav-link" data-path="#/admin/reportes"><span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 3v18h18M7 15l4-4 3 3 6-7"/><path d="M16 7h4v4"/></svg></span>Reportes</a>
    <a href="#/admin/manual" class="nav-link" data-path="#/admin/manual"><span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22V4.5ZM4 18a2.5 2.5 0 0 1 2.5-2.5H20M8 6h8M8 10h8"/></svg></span>Manual de administración</a>
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
        <a href="#/" class="nav-link" data-path="#/"><span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1V10Z"/></svg></span>Inicio</a>
        <a href="#/reservar" class="nav-link" data-path="#/reservar"><span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h3M14 14h2"/></svg></span>Reservar</a>
        <a href="#/mis-reservas" class="nav-link" data-path="#/mis-reservas"><span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg></span>Mis Reservas</a>
        ${adminNav}
        
        <div class="sidebar-divider"></div>
        <a href="#/guia" class="nav-link" data-path="#/guia"><span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22V4.5ZM4 18a2.5 2.5 0 0 1 2.5-2.5H20M8 6h8M8 10h8"/></svg></span>Manual de usuario</a>
        <a href="#" id="btn-logout" class="nav-link text-danger"><span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M10 17l5-5-5-5M15 12H3M21 4v16a1 1 0 0 1-1 1h-7M20 3h-7a1 1 0 0 0-1 1v2"/></svg></span>Cerrar Sesión</a>
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
