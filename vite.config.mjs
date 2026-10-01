import {defineConfig} from 'vite';
import {sites} from '@openai/sites-vite-plugin';
export default defineConfig({
  plugins: [sites()],
  build: {ssr: 'website/worker.mjs', outDir: 'dist', target: 'es2022',
    rolldownOptions: {platform: 'browser', output: {entryFileNames: 'server/index.js', codeSplitting: false}}},
  ssr: {target: 'webworker', noExternal: true}
});
