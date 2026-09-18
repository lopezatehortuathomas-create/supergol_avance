import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// Exportar la instancia de cliente de Supabase (singleton)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
