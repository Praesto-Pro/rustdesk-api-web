import { defineConfig } from 'vite'
import * as path from 'path'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

const NODE_ENV = process.env.NODE_ENV || 'development'
const envFile = `.env.${NODE_ENV}`
const envConfig = dotenv.parse(fs.readFileSync(envFile))
for (const k in envConfig) {
  process.env[k] = envConfig[k]
}

let alias = {
  '@': path.resolve(__dirname, './src'),
  'vue$': 'vue/dist/vue.runtime.esm-bundler.js',
}

const conf = {
  base: './', // Location of index.html
  root: './', // Root for imported resources
  server: {
    open: true,
    port: process.env.VITE_DEV_PORT,
    proxy: {
      [process.env.VITE_SERVER_API]: {
        target: process.env.VITE_SERVER_PATH,
        // rewrite: path => path.replace(/^\/api/, '/api'), //For local simulation
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2020',
    minify: 'esbuild', // Minifier: false, 'terser', or 'esbuild' (default)
    manifest: false, // Generate a manifest
    sourcemap: false, // Generate source maps
    emptyOutDir: true,
    outDir: 'dist', // Output directory
    rollupOptions: {
      output: {
        manualChunks: { 'element-icons': ['@element-plus/icons'] },
        chunkFileNames: 'static/chunk/[name]-[hash].js',
        entryFileNames: 'static/entry/[name]-[hash].js',
        assetFileNames: 'static/[ext]/[name]-[hash].[ext]'
      },
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        javascriptEnabled: true,
      },
    },
  },
  resolve: {
    alias,
  },
  plugins: [
    vue(),
    Components({ dts: false, resolvers: [ElementPlusResolver()] }),
  ],
}

// https://vitejs.dev/config/
export default defineConfig(conf)
