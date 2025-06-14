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
  // Serve static files from multiple possible locations
  const staticDirs = [
    path.resolve(import.meta.dirname, "..", "dist", "public"),
    path.resolve(import.meta.dirname, "..", "client", "public"),
    path.resolve(import.meta.dirname, "..", "client")
  ];

  // Add static directories that exist
  staticDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      console.log(`Serving static files from: ${dir}`);
      app.use(express.static(dir));
    }
  });

  // Handle SPA fallback
  app.use("*", (req, res) => {
    // Try multiple possible locations for index.html
    const possibleIndexPaths = [
      path.join(import.meta.dirname, "..", "dist", "public", "index.html"),
      path.join(import.meta.dirname, "..", "client", "public", "index.html"),
      path.join(import.meta.dirname, "..", "client", "index.html")
    ];

    for (const indexPath of possibleIndexPaths) {
      if (fs.existsSync(indexPath)) {
        console.log(`Serving index.html from: ${indexPath}`);
        return res.sendFile(indexPath);
      }
    }

    // If no index.html found, return 404
    res.status(404).send('Not Found: Could not find index.html in any of the expected locations');
  });
}
