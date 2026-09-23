'use server';

import { createClient } from '@supabase/supabase-js';

// Workaround for SSL revocation check issues in development environments
if (process.env.NODE_ENV === 'development') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabaseServer = createClient(supabaseUrl, supabaseAnonKey);

export async function loginAction(email, password) {
    // 1. Validate environment
    if (!supabaseUrl || !supabaseAnonKey) {
        console.error('SERVER ERROR: Missing Supabase environment variables');
        return {
            success: false,
            error: 'Configuration Error: Missing Supabase URL or Key on server'
        };
    }

    try {
        // 2. Attempt login
        const { data, error } = await supabaseServer.auth.signInWithPassword({
            email,
            password
        });

        // 3. Handle specific Supabase errors
        if (error) {
            console.error('Supabase Login Error:', error.message);
            return {
                success: false,
                error: error.message,
                code: error.status || 'UNKNOWN'
            };
        }

        // 4. Return essential data only (must be serializable)
        // We only send back the session and user to avoid circular reference issues
        return {
            success: true,
            data: {
                user: data.user,
                session: data.session
            }
        };
    } catch (err) {
        // 5. Catch unexpected server errors
        console.error('Server side login exception:', err);
        return {
            success: false,
            error: err.message || 'Error interno del servidor (Exception)',
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        };
    }
}

// Reset password by recreating user (development only)
export async function resetPasswordAction(userEmail, newPassword) {
    try {
        // This creates a new auth user with the new password
        // The existing profile will be linked via email
        const { data, error } = await supabaseServer.auth.signUp({
            email: userEmail,
            password: newPassword,
            options: {
                data: {
                    password_reset: true
                }
            }
        });

        if (error) {
            // If user already exists, try updating via signIn (won't work but gives better error)
            if (error.message.includes('already registered')) {
                return {
                    success: false,
                    error: 'Este usuario ya existe. Para desarrollo, usa el Supabase Dashboard para resetear la contraseña manualmente, o crea un nuevo usuario.'
                };
            }
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (err) {
        console.error('Reset password error:', err);
        return { success: false, error: err.message || 'Error al resetear contraseña' };
    }
}
