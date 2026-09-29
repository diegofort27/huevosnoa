'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

const supabaseServer = createClient(supabaseUrl, supabaseAnonKey);

export async function getCurrentUser() {
    try {
        const { data: { user }, error } = await supabaseServer.auth.getUser();
        if (error) throw error;
        return user;
    } catch (err) {
        console.error('Error fetching user:', err);
        return null;
    }
}
