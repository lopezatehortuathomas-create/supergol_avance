import { signIn, isAdmin, getAuthErrorMessage } from '../auth.js';
import { showToast, setLoading } from '../ui.js';
import { navigateTo } from '../router.js';

export function render() {
    return `
        <div class="login-page">
            <div class="card login-card">
                <a class="auth-close" href="#/" aria-label="Volver al inicio" title="Volver al inicio">&times;</a>
                <div class="login-header text-center">
                    <h2>⚽ Super Gol</h2>
                    <p>Inicia sesión en tu cuenta</p>
                </div>
                <form id="login-form">
                    <div class="form-group">
                        <label class="form-label" for="email">Correo electrónico</label>
                        <input class="form-input" type="email" id="email" required placeholder="tu@email.com">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="password">Contraseña</label>
                        <input class="form-input" type="password" id="password" required placeholder="••••••••">
                    </div>
                    <button type="submit" class="btn btn--primary btn--block" id="login-btn">
                        <span>Iniciar Sesión</span>
                    </button>
                </form>
                <div class="login-footer text-center" style="margin-top: 1rem;">
                    <p><a class="auth-outline-link" href="#/register">Registrarse</a></p>
                </div>
            </div>
        </div>
    `;
}

export function init() {
    const form = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('login-btn');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = emailInput.value.trim();
            const password = passwordInput.value;

            if (!email || !password) {
                showToast('Por favor, completa todos los campos', 'error');
                return;
            }

            try {
                setLoading(loginBtn, true);
                
                const { error } = await signIn(email, password);
                
                if (error) {
                    throw error;
                }
                
                // Verificar si es administrador y redirigir
                const { getCurrentUser } = await import('../auth.js');
                const adminStatus = isAdmin(await getCurrentUser());
                if (adminStatus) {
                    navigateTo('#/admin');
                } else {
                    navigateTo('#/mis-reservas');
                }
                
            } catch (error) {
                showToast(getAuthErrorMessage(error, 'Error al iniciar sesión'), 'error');
            } finally {
                setLoading(loginBtn, false);
            }
        });
    }
}
