import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react({
      fastRefresh: true,
      include: "**/*.tsx",
      babel: {
        plugins: [],
      },
    }),
    tailwindcss(),
    viteSingleFile(),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    extensions: [
      ".mjs",
      ".js",
      ".mts",
      ".ts",
      ".jsx",
      ".tsx",
      ".json",
    ],
    dedupe: ["react", "react-dom"],
  },

  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    open: false,
    cors: true,
    hmr: {
      overlay: true,
      protocol: "ws",
      host: "localhost",
      port: 5173,
      timeout: 30000,
    },
    headers: {
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
    warmup: {
      clientFiles: [
        "./src/main.tsx",
        "./src/App.tsx",
        "./src/index.css",
        "./src/components/**/*.tsx",
      ],
    },
    watch: {
      usePolling: false,
      ignored: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.git/**",
        "**/*.log",
      ],
    },
    proxy: {
      "/api/search/searx": {
        target: "https://search.sapti.me",
        changeOrigin: true,
        timeout: 15000,
        rewrite: (p) => p.replace(/^\/api\/search\/searx/, "/search"),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            proxyReq.setHeader("Accept", "application/json");
          });
          proxy.on("proxyRes", (proxyRes) => {
            proxyRes.headers["Access-Control-Allow-Origin"] = "*";
          });
        },
      },
      "/api/search/ddg": {
        target: "https://lite.duckduckgo.com",
        changeOrigin: true,
        timeout: 10000,
        rewrite: (p) => p.replace(/^\/api\/search\/ddg/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
            proxyReq.setHeader("Accept", "text/html,application/xhtml+xml");
          });
        },
      },
      "/api/search/brave": {
        target: "https://search.brave.com",
        changeOrigin: true,
        timeout: 10000,
        rewrite: (p) => p.replace(/^\/api\/search\/brave/, "/search"),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
            proxyReq.setHeader("Accept", "text/html,application/xhtml+xml");
          });
        },
      },
      "/api/search/startpage": {
        target: "https://www.startpage.com",
        changeOrigin: true,
        timeout: 10000,
        rewrite: (p) => p.replace(/^\/api\/search\/startpage/, "/do/search"),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
            proxyReq.setHeader("Accept", "text/html,application/xhtml+xml");
          });
        },
      },
      "/api/hf": {
        target: "https://api-inference.huggingface.co",
        changeOrigin: true,
        timeout: 30000,
        rewrite: (p) => p.replace(/^\/api\/hf/, ""),
      },
      "/api/arxiv": {
        target: "https://export.arxiv.org",
        changeOrigin: true,
        timeout: 10000,
        rewrite: (p) => p.replace(/^\/api\/arxiv/, "/api"),
      },
      "/api/deezer": {
        target: "https://api.deezer.com",
        changeOrigin: true,
        timeout: 10000,
        rewrite: (p) => p.replace(/^\/api\/deezer/, ""),
      },
      "/api/openlibrary": {
        target: "https://openlibrary.org",
        changeOrigin: true,
        timeout: 15000,
        rewrite: (p) => p.replace(/^\/api\/openlibrary/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
          });
          proxy.on("proxyRes", (proxyRes) => {
            proxyRes.headers["Access-Control-Allow-Origin"] = "*";
          });
        },
      },
    },
  },

  build: {
    target: "esnext",
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
    minify: false,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 500,
    reportCompressedSize: false,
    emptyOutDir: true,
    modulePreload: {
      polyfill: false,
      resolveDependencies: () => [],
    },
    rollupOptions: {
      input: path.resolve(__dirname, "index.html"),
      output: {
        compact: true,
        generatedCode: "es2015",
      },
    },
    commonjsOptions: {
      include: [/node_modules/],
      extensions: [".js", ".cjs"],
    },
  },

  css: {
    devSourcemap: true,
  },

  optimizeDeps: {
    include: ["react", "react-dom", "clsx", "tailwind-merge"],
    exclude: [],
    force: false,
    holdUntil: 30000,
  },

  esbuild: {
    legalComments: "none",
    drop: [],
    keepNames: true,
  },

  logLevel: "info",
  clearScreen: true,
  envPrefix: ["VITE_"],

  preview: {
    port: 4173,
    strictPort: true,
    host: "0.0.0.0",
    open: false,
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  },
});
