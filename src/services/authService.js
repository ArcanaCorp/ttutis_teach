import { isSupabaseConfigured, supabase } from '../libs/supabase';

const SIGN_IN_FUNCTION = 'sign-in-with-code';

export async function signInWithAccessCode(code, password) {
    if (!isSupabaseConfigured || !supabase) {
        throw new Error('La conexión con TTUTIS no está configurada en este dispositivo.');
    }

    const normalizedCode = code.trim().toUpperCase();
    if (!/^[A-Z][0-9]{8}$/.test(normalizedCode) || !password) {
        throw new Error('Ingresa un código válido y tu contraseña.');
    }

    const { data, error } = await supabase.functions.invoke(SIGN_IN_FUNCTION, {
        body: { code: normalizedCode, password },
    });

    if (error?.context?.status === 404) {
        throw new Error('El acceso con código aún no está desplegado en Supabase.');
    }

    if (error?.context?.status >= 500) {
        throw new Error('El servicio de acceso no está disponible. Inténtalo nuevamente en unos minutos.');
    }

    if (error || !data?.session?.access_token || !data?.session?.refresh_token) {
        throw new Error('No se pudo iniciar sesión. Revisa tus datos o inténtalo más tarde.');
    }

    const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
    });

    if (sessionError) throw new Error('No se pudo iniciar sesión. Revisa tus datos o inténtalo más tarde.');
}

export async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error('No se pudo cerrar la sesión. Inténtalo de nuevo.');
}
