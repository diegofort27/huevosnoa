import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function DELETE(request) {
    try {
        const body = await request.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ error: 'Falta el ID del usuario' }, { status: 400 });
        }

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

        // First, check if the user exists
        const { data: userProfile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('id', id)
            .single();

        // 1. Delete from profiles explicitly just in case cascade is not set up
        if (userProfile) {
            await supabaseAdmin.from('profiles').delete().eq('id', id);
        }

        // 2. Delete user from auth schema using Admin API
        const { data, error } = await supabaseAdmin.auth.admin.deleteUser(id);

        if (error) throw error;

        return NextResponse.json({ message: 'Usuario eliminado exitosamente' });

    } catch (error) {
        console.error('Error deleting user:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
