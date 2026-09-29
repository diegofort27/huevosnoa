import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

const customFetch = async (url, options) => {
    try {
        const response = await fetch(url, options);
        return response;
    } catch (err) {
        console.error(`[Supabase Fetch Error] Intento fallido a ${url}:`, err.message);
        // Instead of triggering an Unhandled Rejection that breaks the Next.js app, 
        // return a fake 500 response so that Supabase JS handles it gracefully as an API error.
        return new Response(JSON.stringify({ error: err.message, failedToFetch: true }), {
            status: 503,
            statusText: "Service Unavailable (Client-side Fetch Error)",
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
        fetch: customFetch
    }
});
