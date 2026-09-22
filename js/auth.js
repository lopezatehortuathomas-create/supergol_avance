import { supabase } from './supabase.js';

function getAuthRedirectUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

export async function signUp(email, password, fullName, phone) {
  return await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      emailRedirectTo: getAuthRedirectUrl(),
      data: {
        full_name: fullName,
        phone: phone
      }
    }
  });
}

export async function signIn(email, password) {
  return await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password
  });
}

export function getAuthErrorMessage(error, fallback) {
  const messages = {
    invalid_credentials: 'El correo o la contraseña no son correctos.',
    email_not_confirmed: 'Confirma tu correo electrónico antes de iniciar sesión.',
    email_address_not_authorized: 'Este correo no está autorizado para iniciar sesión.',
    over_email_send_rate_limit: 'Se alcanzó el límite de correos. Espera unos minutos e inténtalo de nuevo.',
    signup_disabled: 'El registro de nuevas cuentas está deshabilitado.',
    user_already_exists: 'Ya existe una cuenta con este correo.'
  };

  return messages[error?.code] || messages[error?.error_code] || error?.message || fallback;
}

export async function signOut() {
  return await supabase.auth.signOut();
}

export async function getCurrentUser() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data) return null;
    const user = data.user || null;
    if (!user) return null;

    // Fallback for accounts whose profile role is updated before the JWT refreshes.
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const profileRole = profile?.role || user?.app_metadata?.user_role || user?.app_metadata?.role || user?.user_metadata?.role;
    if (profileRole) {
      return {
        ...user,
        app_metadata: {
          ...user.app_metadata,
          user_role: profileRole,
          role: profileRole
        },
        user_metadata: {
          ...user.user_metadata,
          user_role: profileRole,
          role: profileRole
        }
      };
    }

    return user;
  } catch (err) {
    console.warn('No hay sesión activa o error de autenticación:', err);
    return null;
  }
}

export async function getSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data) return null;
    return data.session || null;
  } catch (err) {
    return null;
  }
}

export function isAdmin(user) {
  if (!user) return false;

  const role = [
    user?.app_metadata?.user_role,
    user?.app_metadata?.role,
    user?.user_metadata?.user_role,
    user?.user_metadata?.role,
    user?.role,
    user?.profile?.role
  ].find(value => Boolean(value))?.toString().toLowerCase();

  return role === 'admin' || role === 'superadmin';
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}
