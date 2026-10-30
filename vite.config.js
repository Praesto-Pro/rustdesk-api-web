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
  base: './', // index.html文件所在位置
  root: './', // js导入的资源路径，src
  server: {
    open: true,
    port: process.env.VITE_DEV_PORT,
    proxy: {
      [process.env.VITE_SERVER_API]: {
        target: process.env.VITE_SERVER_PATH,
        // rewrite: path => path.replace(/^\/api/, '/api'), //为了模拟
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2020',
    minify: 'esbuild', // 是否进行压缩,boolean | 'terser' | 'esbuild',默认使用 esbuild
    manifest: false, // 是否产出maifest.json
    sourcemap: false, // 是否产出soucemap.json
    emptyOutDir: true,
    outDir: 'dist', // 产出目录
    rollupOptions: {
      output: {
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
