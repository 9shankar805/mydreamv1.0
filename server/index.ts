import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import { runMigrations } from "./migrate";

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Ensure delivery tracking tables exist
const ensureDeliveryTrackingTables = async () => {
  try {
    await runMigrations();
  } catch (error) {
    console.error('Migration error:', error);
  }
};

ensureDeliveryTrackingTables();

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    console.log("Skipping migrations - using existing database tables");
    
    // Initialize database with default admin account
    await storage.createDefaultAdmin();
  } catch (error) {
    console.error("Error initializing database:", error);
  }
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

    // Use environment variable for port or default to 5000 for local development
  const port = process.env.PORT || 5000;
  const host = process.env.HOST || '0.0.0.0';
  
  // Handle different environments
  const isProduction = process.env.NODE_ENV === 'production';
  const protocol = isProduction ? 'https' : 'http';
  
  server.listen({
    port: Number(port),
    host,
    reusePort: true,
  }, () => {
    log(`Server running in ${isProduction ? 'production' : 'development'} mode`);
    log(`Serving on ${protocol}://${host}:${port}`);
    
    // Log environment info for debugging
    if (!isProduction) {
      console.log('Environment Variables:');
      console.log('- NODE_ENV:', process.env.NODE_ENV);
      console.log('- DATABASE_URL:', process.env.DATABASE_URL ? '***' : 'Not set');
      console.log('- HERE_API_KEY:', process.env.HERE_API_KEY ? '***' : 'Not set');
    }
  });
  
  // Handle shutdown gracefully
  process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully');
    server.close(() => {
      console.log('Process terminated');
    });
  });
})();
