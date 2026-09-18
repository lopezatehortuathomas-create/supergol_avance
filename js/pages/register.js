import { signUp, getAuthErrorMessage } from '../auth.js';
import { showToast, setLoading } from '../ui.js';
import { navigateTo } from '../router.js';

export function render() {
    return `
        <div class="register-page">
            <div class="card register-card">
                <a class="auth-close" href="#/" aria-label="Volver al inicio" title="Volver al inicio">&times;</a>
                <div class="register-header text-center">
                    <h2>⚽ Super Gol</h2>
                    <p>Crea tu cuenta</p>
                </div>
                <form id="register-form">
                    <div class="form-group">
                        <label class="form-label" for="full_name">Nombre completo</label>
                        <input class="form-input" type="text" id="full_name" required placeholder="Juan Pérez">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="phone">Teléfono</label>
                        <input class="form-input" type="tel" id="phone" required placeholder="0987654321">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="email">Correo electrónico</label>
                        <input class="form-input" type="email" id="email" required placeholder="tu@email.com">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="password">Contraseña</label>
                        <input class="form-input" type="password" id="password" required placeholder="Mínimo 6 caracteres">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="confirm_password">Confirmar Contraseña</label>
                        <input class="form-input" type="password" id="confirm_password" required placeholder="••••••••">
                    </div>
                    <button type="submit" class="btn btn--primary btn--block" id="register-btn">
                        <span>Crear Cuenta</span>
                    </button>
                </form>
                <div class="register-footer text-center" style="margin-top: 1rem;">
                    <p><a href="#/login">¿Ya tienes cuenta? Inicia sesión</a></p>
                </div>
            </div>
        </div>
    `;
}

export function init() {
    const form = document.getElementById('register-form');
    const fullNameInput = document.getElementById('full_name');
    const phoneInput = document.getElementById('phone');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm_password');
    const registerBtn = document.getElementById('register-btn');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const fullName = fullNameInput.value.trim();
            const phone = phoneInput.value.trim();
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            if (!fullName || !phone || !email || !password || !confirmPassword) {
                showToast('Por favor, completa todos los campos', 'error');
                return;
            }

            if (password !== confirmPassword) {
                showToast('Las contraseñas no coinciden', 'error');
                return;
            }

            if (password.length < 6) {
                showToast('La contraseña debe tener al menos 6 caracteres', 'error');
                return;
            }

            try {
                setLoading(registerBtn, true);
                
                const { data, error } = await signUp(email, password, fullName, phone);
                
                if (error) {
                    throw error;
                }
                
                const message = data.session
                    ? 'Cuenta creada exitosamente.'
                    : 'Cuenta creada. Revisa tu correo para confirmarla antes de iniciar sesión.';
                showToast(message, 'success');
                navigateTo('/login');
                
            } catch (error) {
                showToast(getAuthErrorMessage(error, 'Error al crear la cuenta'), 'error');
            } finally {
                setLoading(registerBtn, false);
            }
        });
    }
}
