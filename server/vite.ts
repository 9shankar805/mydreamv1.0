import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions: any = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true, // This is needed for HMR to work with custom hosts
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      // Try multiple possible locations for the index.html file
      const possibleTemplatePaths = [
        path.resolve(import.meta.dirname, "..", "client", "index.html"),
        path.resolve(import.meta.dirname, "..", "client", "public", "index.html"),
        path.resolve(import.meta.dirname, "..", "dist", "public", "index.html")
      ];

      let template = '';
      let templatePath = '';
      
      // Find the first existing template path
      for (const possiblePath of possibleTemplatePaths) {
        try {
          template = await fs.promises.readFile(possiblePath, "utf-8");
          templatePath = possiblePath;
          break;
        } catch (e) {
          // Continue to next path if file not found
          continue;
        }
      }

      if (!template) {
        throw new Error(`Could not find index.html in any of the following locations:\n${possibleTemplatePaths.join('\n')}`);
      }

      console.log(`Serving template from: ${templatePath}`);
      
      // Only replace the src in development mode
      if (process.env.NODE_ENV !== 'production') {
        template = template.replace(
          `src="/src/main.tsx"`,
          `src="/src/main.tsx?v=${nanoid()}"`,
        );
      }
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const rootDir = path.resolve(import.meta.dirname, '..');
  
  // Possible build output directories
  const staticDirs = [
    path.join(rootDir, 'dist', 'public'),
    path.join(rootDir, 'dist'),
    path.join(rootDir, 'client', 'dist'),
    path.join(rootDir, 'client', 'public'),
    path.join(rootDir, 'client')
  ];

  // Log all directories we'll try to serve from
  console.log('Looking for static files in directories:');
  staticDirs.forEach(dir => {
    console.log(`- ${dir} ${fs.existsSync(dir) ? '(exists)' : '(not found)'}`);
  });

  // Serve static files from existing directories
  staticDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      console.log(`Serving static files from: ${dir}`);
      app.use(express.static(dir, { index: false }));
      
      // Also try serving with /public prefix
      if (dir.endsWith('/public')) {
        const baseDir = dir.replace(/\/public$/, '');
        console.log(`Also serving static files from: ${baseDir}/public`);
        app.use('/public', express.static(dir, { index: false }));
      }
    }
  });

  // Handle SPA fallback
  app.get('*', (req, res) => {
    // Skip API and asset requests
    if (req.path.startsWith('/api/') || req.path.startsWith('/assets/')) {
      return res.status(404).send('Not Found');
    }

    // Try multiple possible locations for index.html
    const possibleIndexPaths = [
      path.join(rootDir, 'dist', 'public', 'index.html'),
      path.join(rootDir, 'dist', 'index.html'),
      path.join(rootDir, 'client', 'dist', 'index.html'),
      path.join(rootDir, 'client', 'public', 'index.html'),
      path.join(rootDir, 'client', 'index.html')
    ];

    for (const indexPath of possibleIndexPaths) {
      if (fs.existsSync(indexPath)) {
        console.log(`Serving index.html from: ${indexPath}`);
        return res.sendFile(indexPath);
      }
    }

    // If no index.html found, return 500 with debug info
    const errorMessage = `Could not find index.html. Tried:\n${possibleIndexPaths.join('\n')}\n\nCurrent directory: ${process.cwd()}\n__dirname: ${__dirname}\nimport.meta.url: ${import.meta.url}`;
    console.error(errorMessage);
    res.status(500).send('Internal Server Error: Could not find index.html');
  });
}
