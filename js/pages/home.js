import { getCurrentUser } from '../auth.js';
import { navigateTo } from '../router.js';

export function render() {
    return `
        <div class="home-page" id="home-container">
            <div class="hero text-center" style="padding: 3rem 1rem;">
                <h1 id="hero-title">Bienvenido a ⚽ Super Gol</h1>
                <p class="subtitle">Tu complejo recreativo favorito</p>
                <div id="hero-actions" class="hero-actions" style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: center;">
                    <!-- Se llenará dinámicamente según el estado de autenticación -->
                </div>
            </div>
            
            <section class="features-section" style="padding: 2rem 1rem;">
                <h2 class="text-center" style="margin-bottom: 2rem;">Nuestras Instalaciones</h2>
                <div class="grid-3" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem;">
                    <div class="card feature-card" data-route="/reservas" style="cursor: pointer; text-align: center;">
                        <div class="feature-icon" style="font-size: 3rem;">⚽</div>
                        <h3>Cancha de Fútbol</h3>
                        <p>Reserva nuestra cancha sintética</p>
                    </div>
                    
                    <div class="card feature-card" data-route="/reservas" style="cursor: pointer; text-align: center;">
                        <div class="feature-icon" style="font-size: 3rem;">🏍️</div>
                        <h3>Pista de Motocross</h3>
                        <p>Vive la adrenalina en nuestra pista</p>
                    </div>
                    
                    <div class="card feature-card" data-route="/reservas" style="cursor: pointer; text-align: center;">
                        <div class="feature-icon" style="font-size: 3rem;">🎱</div>
                        <h3>Mesa de Billar</h3>
                        <p>Disfruta de una partida con amigos</p>
                    </div>
                    
                    <div class="card feature-card" style="text-align: center;">
                        <div class="feature-icon" style="font-size: 3rem;">🏪</div>
                        <h3>Tienda</h3>
                        <p>Refrescos, snacks y cervezas</p>
                    </div>
                </div>
            </section>

            <div class="home-guide-link"><a href="#/guia">Consultar manual de usuario →</a></div>
        </div>
    `;
}

export async function init() {
    const heroActions = document.getElementById('hero-actions');
    const heroTitle = document.getElementById('hero-title');
    const featureCards = document.querySelectorAll('.feature-card[data-route]');
    
    // Navegación para las tarjetas interactivas
    featureCards.forEach(card => {
        card.addEventListener('click', () => {
            const route = card.getAttribute('data-route');
            if (route) {
                navigateTo(route);
            }
        });
    });

    try {
        const user = await getCurrentUser();
        
        if (user) {
            // Usuario autenticado
            const userName = user.user_metadata?.full_name || 'Amigo';
            if (heroTitle) {
                heroTitle.textContent = `¡Hola, ${userName}! Bienvenido a ⚽ Super Gol`;
            }

            
            if (heroActions) {
                heroActions.innerHTML = `
                    <button id="btn-reservar-ahora" class="btn btn--primary">Reservar ahora</button>
                `;
                document.getElementById('btn-reservar-ahora').addEventListener('click', () => {
                    navigateTo('#/reservar');
                });
            }
        } else {
            // Usuario no autenticado
            if (heroActions) {
                heroActions.innerHTML = `
                    <button id="btn-login" class="btn btn--outline">Iniciar Sesión</button>
                    <button id="btn-register" class="btn btn--outline">Registrarse</button>
                `;
                document.getElementById('btn-login').addEventListener('click', () => {
                    navigateTo('#/login');
                });
                document.getElementById('btn-register').addEventListener('click', () => {
                    navigateTo('#/register');
                });
            }
        }
    } catch (error) {
        console.error('Error al obtener estado de usuario:', error);
    }
}
