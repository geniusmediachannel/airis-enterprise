import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), ['VITE_', 'NEXT_PUBLIC_']);
  const supabaseUrl = 
    process.env.VITE_SUPABASE_URL || 
    process.env.NEXT_PUBLIC_SUPABASE_URL || 
    env.VITE_SUPABASE_URL || 
    env.NEXT_PUBLIC_SUPABASE_URL || 
    'https://inifunrwbxeeglzgklfr.supabase.co';

  const supabaseKey = 
    process.env.VITE_SUPABASE_ANON_KEY || 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
    env.VITE_SUPABASE_ANON_KEY || 
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
    '';

  return {
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    define: {
      '__AIRIS_SUPABASE_URL__': JSON.stringify(supabaseUrl),
      '__AIRIS_SUPABASE_ANON_KEY__': JSON.stringify(supabaseKey),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
