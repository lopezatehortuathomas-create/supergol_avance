import { getCurrentUser } from '../auth.js';
import { navigateTo } from '../router.js';

export function render() {
    return `
        <div class="home-page" id="home-container">
            <section class="home-hero">
                <div class="home-hero__content">
                    <p class="home-hero__eyebrow"><span aria-hidden="true">●</span> DEPORTE · AMIGOS · PASIÓN</p>
                    <h1 id="hero-title">Bienvenido a <span>Super Gol</span></h1>
                    <p class="subtitle">Tu próximo gran partido empieza aquí.</p>
                    <div id="hero-actions" class="hero-actions">
                    </div>
                </div>
                <div class="home-hero__pitch" aria-hidden="true">
                    <span class="home-hero__ball">⚽</span>
                    <span class="home-hero__pitch-label">TU CANCHA<br>TE ESPERA</span>
                </div>
            </section>

            <section class="features-section" aria-labelledby="facilities-title">
                <div class="section-heading">
                    <div>
                        <p class="home-hero__eyebrow">ENCUENTRA TU JUEGO</p>
                        <h2 id="facilities-title">Nuestras instalaciones</h2>
                    </div>
                    <span class="section-heading__note">Elige tu próximo plan</span>
                </div>
                <div class="features-grid">
                    <button type="button" class="card feature-card feature-card--football" data-route="/reservas">
                        <span class="feature-icon" aria-hidden="true">⚽</span>
                        <span class="feature-card__content">
                            <span class="feature-card__eyebrow">JUEGA EN EQUIPO</span>
                            <span class="feature-card__title">Cancha de fútbol</span>
                            <span class="feature-card__description">Reserva nuestra cancha sintética y arma el partido.</span>
                        </span>
                        <span class="feature-card__arrow" aria-hidden="true">↗</span>
                    </button>

                    <button type="button" class="card feature-card feature-card--motocross" data-route="/reservas">
                        <span class="feature-icon" aria-hidden="true">🏍️</span>
                        <span class="feature-card__content">
                            <span class="feature-card__eyebrow">SUBE LA ADRENALINA</span>
                            <span class="feature-card__title">Pista de motocross</span>
                            <span class="feature-card__description">Siente la emoción y disfruta cada vuelta.</span>
                        </span>
                        <span class="feature-card__arrow" aria-hidden="true">↗</span>
                    </button>

                    <button type="button" class="card feature-card feature-card--billiards" data-route="/reservas">
                        <span class="feature-icon" aria-hidden="true">🎱</span>
                        <span class="feature-card__content">
                            <span class="feature-card__eyebrow">EL PLAN CON AMIGOS</span>
                            <span class="feature-card__title">Mesa de billar</span>
                            <span class="feature-card__description">Una buena partida siempre es una buena idea.</span>
                        </span>
                        <span class="feature-card__arrow" aria-hidden="true">↗</span>
                    </button>

                    <article class="card feature-card feature-card--store">
                        <span class="feature-icon" aria-hidden="true">🥤</span>
                        <span class="feature-card__content">
                            <span class="feature-card__eyebrow">RECARGA ENERGÍA</span>
                            <span class="feature-card__title">Tienda</span>
                            <span class="feature-card__description">Refrescos y snacks para completar el plan.</span>
                        </span>
                    </article>
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
