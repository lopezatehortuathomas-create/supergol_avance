const browserConfig = typeof window !== 'undefined' ? window.SUPABASE_CONFIG || {} : {};

export const APP_URL = browserConfig.APP_URL || 'https://supergol.supergol.workers.dev';
export const SUPABASE_URL = browserConfig.SUPABASE_URL || 'https://rfnrxnpyukwdancuikfj.supabase.co';
export const SUPABASE_ANON_KEY = browserConfig.SUPABASE_ANON_KEY || '';
