import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    open: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@amit/adaptivity': path.resolve(__dirname, '../packages/adaptivity/src'),
      '@amit/telemetry/vue': path.resolve(__dirname, '../packages/telemetry/src/vue.ts'),
      '@amit/telemetry': path.resolve(__dirname, '../packages/telemetry/src'),
      '@amit/rules-builder': path.resolve(__dirname, '../packages/rules-builder/src'),
      '@amit/chatbot/vue': path.resolve(__dirname, '../packages/chatbot/src/vue.ts'),
      '@amit/chatbot': path.resolve(__dirname, '../packages/chatbot/src'),
    }
  },
  optimizeDeps: {
    exclude: [
      '@amit/adaptivity',
      '@amit/telemetry',
      '@amit/rules-builder',
      '@amit/chatbot',
      // TalkingHead modules - loaded at runtime from public folder
      'talkinghead.mjs',
      'lipsync-en.mjs',
      'dynamicbones.mjs'
    ],
    include: ['vue-renderer-markdown']
  },
  build: {
    rollupOptions: {
      // Don't bundle TalkingHead - loaded at runtime from public folder
      external: ['/lib/talkinghead/talkinghead.mjs']
    }
  }
});
