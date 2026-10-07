import { getCurrentUser, getAuthErrorMessage, isAdmin, requestPasswordReset, updatePassword } from '../auth.js';
import { showToast, setLoading } from '../ui.js';
import { navigateTo } from '../router.js';
import { supabase } from '../supabase.js';

function isChangePasswordRoute() {
  return window.location.hash === '#/cambiar-contrasena';
}

export function render() {
  if (isChangePasswordRoute()) {
    return `
      <div class="login-page password-recovery-page">
        <div class="card login-card">
          <a class="auth-close" href="#/login" aria-label="Volver al inicio de sesión" title="Volver al inicio de sesión">&times;</a>
          <div class="login-header text-center">
            <h2>⚽ Super Gol</h2>
            <p>Crea una contraseña nueva</p>
          </div>
          <p id="password-recovery-status" class="password-recovery-message" role="status">Verificando el enlace de recuperación...</p>
          <form id="change-password-form" hidden>
            <div class="form-group">
              <label class="form-label" for="new-password">Nueva contraseña</label>
              <input class="form-input" type="password" id="new-password" required minlength="6" autocomplete="new-password" placeholder="Mínimo 6 caracteres">
            </div>
            <div class="form-group">
              <label class="form-label" for="confirm-new-password">Confirmar nueva contraseña</label>
              <input class="form-input" type="password" id="confirm-new-password" required minlength="6" autocomplete="new-password" placeholder="Escribe la contraseña otra vez">
            </div>
            <button type="submit" class="btn btn--primary btn--block" id="change-password-btn">Guardar contraseña</button>
          </form>
          <a class="password-recovery-back" href="#/recuperar-contrasena">Solicitar otro enlace</a>
        </div>
      </div>
    `;
  }

  return `
    <div class="login-page password-recovery-page">
      <div class="card login-card">
        <a class="auth-close" href="#/login" aria-label="Volver al inicio de sesión" title="Volver al inicio de sesión">&times;</a>
        <div class="login-header text-center">
          <h2>⚽ Super Gol</h2>
          <p>Recuperar contraseña</p>
        </div>
        <p class="password-recovery-message">Escribe el correo de tu cuenta y te enviaremos un enlace para crear una contraseña nueva.</p>
        <form id="request-password-form">
          <div class="form-group">
            <label class="form-label" for="recovery-email">Correo electrónico</label>
            <input class="form-input" type="email" id="recovery-email" required autocomplete="email" placeholder="tu@email.com">
          </div>
          <button type="submit" class="btn btn--primary btn--block" id="request-password-btn">Enviar enlace</button>
        </form>
        <a class="password-recovery-back" href="#/login">Volver al inicio de sesión</a>
      </div>
    </div>
  `;
}

export async function init() {
  if (isChangePasswordRoute()) {
    await initChangePassword();
    return;
  }
  initRequestPassword();
}

function initRequestPassword() {
  const form = document.getElementById('request-password-form');
  const emailInput = document.getElementById('recovery-email');
  const submitButton = document.getElementById('request-password-btn');

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const email = emailInput.value.trim();
    if (!email) {
      showToast('Escribe el correo electrónico de tu cuenta.', 'error');
      return;
    }

    try {
      setLoading(submitButton, true);
      const { error } = await requestPasswordReset(email);
      if (error) throw error;
      showToast('Si el correo pertenece a una cuenta, recibirás un enlace para cambiar la contraseña.', 'success', 6000);
      form.reset();
    } catch (error) {
      showToast(getAuthErrorMessage(error, 'No se pudo enviar el enlace de recuperación.'), 'error', 6000);
    } finally {
      setLoading(submitButton, false);
    }
  });
}

async function initChangePassword() {
  const status = document.getElementById('password-recovery-status');
  const form = document.getElementById('change-password-form');
  const { data, error } = await getRecoverySession();

  if (error || !data?.session) {
    status.textContent = 'Este enlace no es válido o ya venció. Solicita uno nuevo para continuar.';
    return;
  }

  status.textContent = 'Elige una contraseña segura de al menos 6 caracteres.';
  form.hidden = false;
  const passwordInput = document.getElementById('new-password');
  const confirmInput = document.getElementById('confirm-new-password');
  const submitButton = document.getElementById('change-password-btn');

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const password = passwordInput.value;
    if (password.length < 6) {
      showToast('La contraseña debe tener al menos 6 caracteres.', 'error');
      return;
    }
    if (password !== confirmInput.value) {
      showToast('Las contraseñas no coinciden.', 'error');
      return;
    }

    try {
      setLoading(submitButton, true);
      const { error: updateError } = await updatePassword(password);
      if (updateError) throw updateError;
      showToast('Contraseña actualizada correctamente.', 'success');
      const user = await getCurrentUser();
      navigateTo(isAdmin(user) ? '#/admin' : '#/mis-reservas');
    } catch (error) {
      showToast(getAuthErrorMessage(error, 'No se pudo actualizar la contraseña.'), 'error', 6000);
    } finally {
      setLoading(submitButton, false);
    }
  });
}

async function getRecoverySession() {
  return await supabase.auth.getSession();
}
