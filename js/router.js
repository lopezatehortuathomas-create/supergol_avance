import { getCurrentUser, isAdmin, onAuthStateChange } from './auth.js';
import * as navbar from './components/navbar.js';
import { setLoading } from './ui.js';

// Configuración de rutas
const routes = new Map([
  ['#/', { module: './pages/home.js', requiresAuth: false, requiresAdmin: false, title: 'Inicio - Super Gol' }],
  ['#/login', { module: './pages/login.js', requiresAuth: false, requiresAdmin: false, title: 'Iniciar Sesión - Super Gol' }],
  ['#/register', { module: './pages/register.js', requiresAuth: false, requiresAdmin: false, title: 'Registro - Super Gol' }],
  ['#/guia', { module: './pages/user-guide.js', requiresAuth: false, requiresAdmin: false, title: 'Manual de usuario - Super Gol' }],
  ['#/mis-reservas', { module: './pages/user-dashboard.js', requiresAuth: true, requiresAdmin: false, title: 'Mis Reservas - Super Gol' }],
  ['#/reservar', { module: './pages/reservations.js', requiresAuth: true, requiresAdmin: false, title: 'Reservar - Super Gol' }],
  ['#/admin', { module: './pages/admin-dashboard.js', requiresAuth: true, requiresAdmin: true, title: 'Admin - Super Gol' }],
  ['#/admin/reservas', { module: './pages/admin-reservations.js', requiresAuth: true, requiresAdmin: true, title: 'Gestión de Reservas - Super Gol' }],
  ['#/admin/usos', { module: './pages/admin-usage.js', requiresAuth: true, requiresAdmin: true, title: 'Registro de Usos - Super Gol' }],
  ['#/admin/inventario', { module: './pages/admin-inventory.js', requiresAuth: true, requiresAdmin: true, title: 'Inventario - Super Gol' }],
  ['#/admin/reportes', { module: './pages/admin-reports.js', requiresAuth: true, requiresAdmin: true, title: 'Reportes - Super Gol' }]
]);

// Navegar a un hash específico
export function navigateTo(hash) {
  const aliases = {
    '/reservas': '#/reservar',
    'reservas': '#/reservar',
    'admin-reservations': '#/admin/reservas',
    '/admin-reservations': '#/admin/reservas',
    'admin-usage': '#/admin/usos',
    'pos': '#/admin/inventario'
  };
  window.location.hash = aliases[hash] || (hash.startsWith('#/') ? hash : `#/${hash.replace(/^\//, '')}`);
}

// Manejador del cambio de ruta
async function handleRoute() {
  const hash = window.location.hash || '#/';
  const route = routes.get(hash) || routes.get('#/');
  const appContainer = document.getElementById('app');
  const sidebarContainer = document.getElementById('sidebar-container');
  
  setLoading(true);

  try {
    const user = await getCurrentUser();
    const isUserAdmin = isAdmin(user);

    // Guardias de navegación
    if (route.requiresAuth && !user) {
      navigateTo('#/login');
      return;
    }
    if (route.requiresAdmin && !isUserAdmin) {
      navigateTo('#/');
      return;
    }
    if (user && (hash === '#/login' || hash === '#/register')) {
      navigateTo(isUserAdmin ? '#/admin' : '#/mis-reservas');
      return;
    }

    document.title = route.title;

    // Renderizar navbar si hay usuario autenticado
    if (user) {
      sidebarContainer.innerHTML = navbar.render(user);
      navbar.init();
      document.body.classList.add('has-sidebar');
    } else {
      sidebarContainer.innerHTML = '';
      document.body.classList.remove('has-sidebar');
    }

    // Cargar módulo de la página dinámicamente
    const pageModule = await import(route.module);
    
    // Renderizar HTML
    appContainer.innerHTML = await pageModule.render();
    
    // Inicializar lógica de la página
    if (typeof pageModule.init === 'function') {
      await pageModule.init();
    }
    
  } catch (error) {
    console.error('Error al cargar la página:', error);
    appContainer.innerHTML = `<div class="error" style="padding: 2rem; text-align: center; color: red;">
      <h3>Error al cargar la página</h3>
      <p>${error.message || error.toString()}</p>
      <pre style="text-align: left; font-size: 12px; margin-top: 1rem; overflow: auto;">${error.stack || ''}</pre>
    </div>`;
  } finally {
    setLoading(false);
  }
}

// Inicializar el router
export function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  
  onAuthStateChange((event, session) => {
    // Recargar la ruta actual cuando el estado de auth cambia
    handleRoute();
  });
  
  handleRoute();
}
