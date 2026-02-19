import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => ({
    plugins: [react(), tailwindcss()],
    root: resolve(__dirname, 'src'),
    resolve: {
        alias: {
            '@stashes': resolve(__dirname, 'src/features/stashes'),
            '@prs': resolve(__dirname, 'src/features/prs'),
            '@issues': resolve(__dirname, 'src/features/issues'),
            '@notes': resolve(__dirname, 'src/features/notes'),
            '@mattermost': resolve(__dirname, 'src/features/mattermost'),
            '@projects': resolve(__dirname, 'src/features/projects'),
            '@drive': resolve(__dirname, 'src/features/drive'),
            '@calendar': resolve(__dirname, 'src/features/calendar'),
            '@wiki': resolve(__dirname, 'src/features/wiki'),
            '@ai': resolve(__dirname, 'src/features/ai'),
            '@settings': resolve(__dirname, 'src/features/settings'),
            '@': resolve(__dirname, 'src'),
        },
    },
    build: {
        outDir: resolve(__dirname, '..', 'dist'),
        emptyOutDir: false, // Don't wipe the extension bundle
        rollupOptions: {
            input: resolve(__dirname, 'src', 'main.tsx'),
            output: {
                entryFileNames: 'webview.js',
                assetFileNames: 'webview.[ext]',
                // Single chunk — no code splitting (webview loads one <script>)
                manualChunks: undefined,
            },
        },
        // Extract CSS as a separate file (required: webview CSP blocks inline styles)
        cssCodeSplit: false,
        // Single-file bundle is intentional for webview <script> loading
        chunkSizeWarningLimit: 2000,
        sourcemap: mode !== 'production',
        minify: mode === 'production' ? 'esbuild' : false,
    },
}));
