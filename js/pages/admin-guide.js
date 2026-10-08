import { getCurrentUser, isAdmin } from '../auth.js';
import { navigateTo } from '../router.js';

export function render() {
  return `
    <div class="page-container user-guide-page">
      <header class="user-guide-hero">
        <p class="eyebrow">SUPERGOL · ADMINISTRACIÓN</p>
        <h1>Manual de administración</h1>
        <p>Guía de las herramientas para operar reservas, usos, inventario, ventas y reportes.</p>
      </header>

      <section class="manual-section">
        <div class="manual-section__title"><span>01</span><h2>Panel principal</h2></div>
        <div class="manual-grid manual-grid--three">
          <article class="manual-card"><span class="manual-card__icon">$</span><h3>Ventas de hoy</h3><p>Consulta los ingresos registrados durante el día.</p></article>
          <article class="manual-card"><span class="manual-card__icon">!</span><h3>Stock crítico</h3><p>Revisa cuántos productos están en su mínimo o por debajo y entra a Inventario para gestionarlos.</p></article>
          <article class="manual-card"><span class="manual-card__icon">R</span><h3>Reservas de hoy</h3><p>Consulta las actividades programadas para la fecha actual.</p></article>
        </div>
        <div class="manual-actions">
          <div><strong>Productos más vendidos</strong><p>Elige un mes para comparar los productos vendidos.</p></div>
          <div><strong>Inventario en alerta</strong><p>Consulta productos que requieren reposición. <a href="#/admin/inventario">Abrir Inventario</a></p></div>
          <div><strong>Reservas y actividades</strong><p>Revisa las reservas del día. <a href="#/admin/reservas">Abrir Gestión de Reservas</a></p></div>
        </div>
      </section>

      <section class="manual-section">
        <div class="manual-section__title"><span>02</span><h2>Gestión de reservas</h2></div>
        <div class="manual-grid">
          <article class="manual-card"><h3>Filtrar la lista</h3><p>Combina el tipo de espacio y el estado. Usa <strong>Refrescar</strong> para volver a cargar los registros.</p></article>
          <article class="manual-card"><h3>Resolver solicitudes</h3><p>En estado pendiente puedes <strong>Aprobar</strong> o <strong>Rechazar</strong>. En una aprobada puedes marcarla <strong>Completada</strong> o <strong>Cancelar</strong>.</p></article>
          <article class="manual-card"><h3>Eliminar de la gestión</h3><p>El botón <strong>Eliminar</strong> quita la reserva de Aprobación y guarda una copia en el historial.</p></article>
          <article class="manual-card"><h3>Consultar historial</h3><p>Debajo de la lista, elige una fecha y pulsa <strong>Buscar</strong>. <strong>Limpiar</strong> borra la tabla del historial. Puedes eliminar una fila del historial con su botón <strong>Eliminar</strong>; si sigue activa, también se quitará de Aprobación.</p></article>
        </div>
        <p class="manual-back-link"><a href="#/admin/reservas">Ir a Gestión de Reservas</a></p>
      </section>

      <section class="manual-section">
        <div class="manual-section__title"><span>03</span><h2>Registro de usos</h2></div>
        <div class="manual-grid">
          <article class="manual-card"><h3>Registrar uso manual</h3><p>Selecciona el espacio e ingresa nombre, celular, duración en minutos y hora. La fecha se establece en hoy y la hora permitida va de 08:00 a 20:00. Las notas son opcionales.</p></article>
          <article class="manual-card"><h3>Filtrar el historial</h3><p>Busca por fecha y filtra por espacio. La tabla reúne los usos manuales y las reservas completadas.</p></article>
          <article class="manual-card"><h3>Eliminar registros</h3><p>Los usos manuales tienen el botón <strong>Eliminar</strong>. Las reservas completadas aparecen como información y no se borran desde esta tabla.</p></article>
          <article class="manual-card"><h3>Uso por zona</h3><p>Consulta los resúmenes por espacio para hoy, esta semana y este mes.</p></article>
        </div>
        <p class="manual-back-link"><a href="#/admin/usos">Ir a Registro de Usos</a></p>
      </section>

      <section class="manual-section">
        <div class="manual-section__title"><span>04</span><h2>Inventario y ventas</h2></div>
        <div class="manual-grid">
          <article class="manual-card"><h3>Catálogo</h3><p>Busca por nombre y filtra por categoría. Al agregar o editar puedes definir nombre, categoría, precio, stock actual y mínimo. La imagen se sugiere según el producto; subir un archivo solo muestra una vista previa y no lo guarda. <strong>Eliminar</strong> desactiva el producto sin borrar sus ventas anteriores.</p></article>
          <article class="manual-card"><h3>Punto de venta</h3><p>Abre la pestaña <strong>Punto de venta</strong>, selecciona productos para agregarlos al carrito, ajusta cantidades con +/− o quita un producto. <strong>Registrar Venta</strong> confirma el cobro y descuenta el stock. El resumen muestra productos, unidades e ingresos del día.</p></article>
          <article class="manual-card"><h3>Historial de ventas</h3><p>Selecciona una fecha para ver ventas, vendedor, productos y total del día. Usa <strong>Ver Detalle</strong> para consultar cantidades, precios unitarios y subtotales.</p></article>
          <article class="manual-card"><h3>Alerta de stock</h3><p>El aviso aparece cuando un producto llega al stock mínimo o queda por debajo. Actualiza el stock desde <strong>Editar</strong> después de reponerlo.</p></article>
        </div>
        <p class="manual-back-link"><a href="#/admin/inventario">Ir a Inventario</a></p>
      </section>

      <section class="manual-section">
        <div class="manual-section__title"><span>05</span><h2>Reportes</h2></div>
        <div class="manual-grid manual-grid--three">
          <article class="manual-card"><h3>Elegir periodo</h3><p>Define las fechas de inicio y fin, sin seleccionar días futuros. El reporte se actualiza al cambiar las fechas o al pulsar <strong>Generar Reporte</strong>.</p></article>
          <article class="manual-card"><h3>Ventas</h3><p>Consulta unidades, ingresos, gráfico de productos más vendidos y detalle por producto, categoría, unidades e ingresos.</p></article>
          <article class="manual-card"><h3>Reservas</h3><p>Compara las reservas del periodo por estado y por tipo de espacio.</p></article>
        </div>
        <p class="manual-back-link"><a href="#/admin/reportes">Ir a Reportes</a></p>
      </section>

      <section class="manual-section">
        <div class="manual-section__title"><span>06</span><h2>Información del lugar</h2></div>
        <div class="manual-grid">
          <article class="manual-card"><h3>Dirección del complejo</h3><p>En <strong>Lugar</strong>, actualiza la dirección y guarda los cambios. Los visitantes pueden consultarla y abrir el enlace para llegar.</p></article>
          <article class="manual-card"><h3>Galería de fotos</h3><p>Agrega fotos JPG, PNG o WEBP de hasta 5 MB cada una. Antes de subirlas puedes revisar los archivos seleccionados; después, añade o actualiza la descripción de cada foto desde la galería.</p></article>
        </div>
        <p class="manual-back-link"><a href="#/lugar">Ir a Lugar</a></p>
      </section>

      <section class="manual-section">
        <div class="manual-section__title"><span>07</span><h2>Acceso y sesión</h2></div>
        <div class="manual-actions">
          <div><strong>Herramientas de administración</strong><p>Dashboard, Gestión de Reservas, Registro de Usos, Inventario y Reportes aparecen solo con una cuenta administradora.</p></div>
          <div><strong>Manual de usuario</strong><p>El manual de usuario está disponible en el menú lateral, debajo de este manual.</p></div>
          <div><strong>Cerrar sesión</strong><p>Usa <strong>Cerrar Sesión</strong> al terminar para salir de la cuenta.</p></div>
        </div>
      </section>

      <a class="manual-back-link" href="#/admin">Volver al Dashboard</a>
    </div>
  `;
}

export async function init() {
  const user = await getCurrentUser();
  if (!isAdmin(user)) navigateTo('#/');
}