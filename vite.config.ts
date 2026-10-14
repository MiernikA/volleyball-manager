import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import packageJson from './package.json' with { type: 'json' };
export default defineConfig({base:'./',plugins:[react()],define:{__APP_VERSION__:JSON.stringify(`v${packageJson.version}`)},resolve:{alias:{'@/app':resolve(import.meta.dirname,'src/app'),'@/pages':resolve(import.meta.dirname,'src/pages')}},test:{environment:'jsdom',setupFiles:'./src/app/test-setup.ts'}});
