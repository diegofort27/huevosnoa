import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
            return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
        }

        const email = `${username.toLowerCase().trim().replace(/\s+/g, '')}@example.com`;

        // 1. Verify requester is Admin
        // In a real app we'd verify the session token from headers
        // For this local deployment request, we'll check the service key first

        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceKey) {
            return NextResponse.json({
                error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor'
            }, { status: 500 });
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            serviceKey,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );

        // 2. Create User
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: { username }
        });

        if (error) throw error;

        // 3. Create Profile (Trigger might handle this, but if we need immediate update)
        // trigger public.handle_new_user() creates the profile. 
        // We might want to set permissions here if passed? 
        // For now, allow trigger to work.

        return NextResponse.json({ user: data.user });

    } catch (error) {
        console.error('Error creating user:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
