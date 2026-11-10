/* global Deno */
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const invalidCredentials = () => Response.json(
    { error: 'No se pudo iniciar sesión. Revisa tus datos o inténtalo más tarde.' },
    { status: 401, headers: corsHeaders },
);

function parseKeyMap(value) {
    if (!value) return {};
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function isMissingTable(error) {
    return error?.code === '42P01' || error?.code === 'PGRST205';
}

async function findByCode(admin, table, code, codeColumn, fields) {
    const { data, error } = await admin.from(table).select(fields).eq(codeColumn, code).limit(2);
    if (error && isMissingTable(error)) return [];
    if (error) throw error;
    return data || [];
}

Deno.serve(async (request) => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

    const publishableKeys = parseKeyMap(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'));
    const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') || publishableKeys.default || Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
    const secretKeys = parseKeyMap(Deno.env.get('SUPABASE_SECRET_KEYS'));
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || secretKeys.default || Deno.env.get('SUPABASE_SECRET_KEY');
    const url = Deno.env.get('SUPABASE_URL');
    const suppliedKey = request.headers.get('apikey');
    const allowedKeys = new Set([
        ...Object.values(publishableKeys),
        Deno.env.get('SUPABASE_ANON_KEY'),
        Deno.env.get('SUPABASE_PUBLISHABLE_KEY'),
    ].filter(Boolean));

    if (!url || !publishableKey || !serviceRoleKey || !suppliedKey || !allowedKeys.has(suppliedKey)) {
        return Response.json({ error: 'Servicio de acceso no disponible.' }, { status: 503, headers: corsHeaders });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return invalidCredentials();
    }

    const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!/^[A-Z][0-9]{8}$/.test(code) || !password || password.length > 256) return invalidCredentials();

    const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const client = createClient(url, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });

    try {
        const [legacyRows, accessCodeRows] = await Promise.all([
            findByCode(admin, 'memberships', code, 'login_code', 'profile_id, email, role, status'),
            findByCode(admin, 'user_access_codes', code, 'code', 'profile_id, status'),
        ]);

        const profiles = new Map();
        for (const row of legacyRows) {
            if (row.status === 'ACTIVE' && row.profile_id) profiles.set(row.profile_id, row.email || '');
        }
        for (const row of accessCodeRows) {
            if (row.status === 'ACTIVE' && row.profile_id) profiles.set(row.profile_id, profiles.get(row.profile_id) || '');
        }
        if (profiles.size !== 1) return invalidCredentials();

        const [profileId, membershipEmail] = [...profiles.entries()][0];
        const { data: userResult, error: userError } = await admin.auth.admin.getUserById(profileId);
        if (userError || !userResult?.user) return invalidCredentials();

        const email = userResult.user.email || membershipEmail;
        if (!email) return invalidCredentials();

        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error || !data?.session?.access_token || !data?.session?.refresh_token) return invalidCredentials();

        return Response.json({ session: data.session }, { status: 200, headers: corsHeaders });
    } catch (error) {
        console.error('Access-code sign-in failed.', error?.message || 'Unknown error');
        return invalidCredentials();
    }
});
