import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { isSupabaseConfigured, supabase } from '../libs/supabase';
import { signInWithAccessCode, signOut } from '../services/authService';
import { getStaffSummary } from '../services/staffServices';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(Boolean(supabase));
    const [staffState, setStaffState] = useState(null);

    useEffect(() => {
        if (!supabase) {
            return undefined;
        }

        let mounted = true;
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            if (!mounted) return;
            setSession(nextSession);
            setLoading(false);
        });

        supabase.auth.getSession().then(({ data }) => {
            if (!mounted) return;
            setSession(data?.session || null);
            setLoading(false);
        }).catch(() => {
            if (!mounted) return;
            setSession(null);
            setLoading(false);
        });

        const appStateSubscription = Platform.OS !== 'web'
            ? AppState.addEventListener('change', (state) => {
                if (state === 'active') supabase.auth.startAutoRefresh();
                else supabase.auth.stopAutoRefresh();
            })
            : null;

        return () => {
            mounted = false;
            subscription.unsubscribe();
            appStateSubscription?.remove();
        };
    }, []);

    useEffect(() => {
        let mounted = true;
        if (!session?.user?.id) {
            return () => { mounted = false; };
        }
        getStaffSummary(session.user.id).then((summary) => {
            if (mounted) setStaffState({ userId: session.user.id, summary });
        }).catch(() => {
            if (mounted) setStaffState({ userId: session.user.id, summary: { displayName: '', institutionName: '', role: '', loadError: true } });
        });
        return () => { mounted = false; };
    }, [session?.user?.id]);

    const value = useMemo(() => ({
        session,
        loading,
        staff: staffState && staffState.userId === session?.user?.id ? staffState.summary : null,
        staffLoading: Boolean(session?.user?.id && staffState?.userId !== session.user.id),
        isConfigured: isSupabaseConfigured,
        signIn: signInWithAccessCode,
        signOut,
    }), [session, loading, staffState]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    return useContext(AuthContext);
}
