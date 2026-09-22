import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // Vue (and other bundled libs) check process.env.NODE_ENV at runtime. Replacing it
  // at build time makes the UMD artifact self-contained and drops development-only
  // code paths - the wrapper does not provide any process shim, so a build without
  // this fails in Zabbix with "ReferenceError: process is not defined".
  //
  // Must sit at the top level of the config: `define` nested under `build` is
  // silently ignored by Vite.
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  // The library build produces the two wrapper assets and nothing else - without
  // this, Vite would also copy public/ (the dev harness's sample document) to dist/.
  publicDir: false,
  build: {
    emptyOutDir: false, // do not clear output dir - used by other builds
    lib: {
      entry: 'src/entry.js',
      name: 'ZbxVueWidget', // Global name for UMD/IIFE wrapper
      formats: ['umd'], // or ['iife']
      fileName: () => 'MDtext.umd.js', // Output file name
      cssFileName: 'MDtext', // Output CSS file name (MDtext.css)
    },
    rollupOptions: {
      // Do not externalize anything -> Vue, marked, DOMPurify bundled inside
      external: [],
      output: {
        // Ensure it behaves as a library
        inlineDynamicImports: true,
      },
    },
  },
})
