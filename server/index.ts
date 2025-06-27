// Đọc biến môi trường từ file .env
import dotenv from "dotenv";
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupKafkaConsumer, disconnectKafkaConsumer } from "./kafka-consumer";
import { emailService, SMTPConfig } from "./email";
import { simulateKafkaMessage } from "./kafka-simulator";
import { FileCleanupService } from "./file-cleanup";
import { logger } from "./logger";

const app = express();
// Improved JSON parsing with error handling
app.use((req, res, next) => {
  // Set default content type for API routes
  if (req.originalUrl.startsWith("/api")) {
    res.setHeader("Content-Type", "application/json");
  }
  next();
});

app.use(
  express.json({
    limit: "50mb",
    verify: (req, res, buf, encoding) => {
      try {
        JSON.parse(buf.toString());
      } catch (e) {
        console.error("JSON parsing error:", e);
        throw new Error("Invalid JSON in request body");
      }
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "50mb" }));

// Cấu hình CORS để cho phép truy cập từ Vite development server
app.use((req, res, next) => {
  // Cho phép các yêu cầu từ frontend (development & production)
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  // Cho phép gửi cookie qua các domain
  res.header("Access-Control-Allow-Credentials", "true");
  // Cho phép các HTTP methods
  res.header("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE");
  // Cho phép các headers
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  );

  // Xử lý OPTIONS request (preflight)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  next();
});

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
      // Use structured API logging
      logger.apiRequest(
        req.method,
        path,
        res.statusCode,
        duration,
        capturedJsonResponse,
      );
    }
  });

  next();
});

(async () => {
  // Define routes FIRST (before static middleware)
  const server = await registerRoutes(app);

  // API middleware to ensure JSON responses
  app.use("/api", (req, res, next) => {
    console.log(`API Request: ${req.method} ${req.originalUrl}`);
    res.setHeader("Content-Type", "application/json");

    // Override res.send to ensure JSON for API routes
    const originalSend = res.send;
    res.send = function (data) {
      this.setHeader("Content-Type", "application/json");
      return originalSend.call(this, data);
    };

    next();
  });

  // Debug middleware for tick routes - AFTER routes are registered
  app.use("/api/tick-requests*", (req, res, next) => {
    console.log("🎯 TICK API REQUEST INTERCEPTED:");
    console.log("- Method:", req.method);
    console.log("- URL:", req.url);
    console.log("- Full URL:", req.originalUrl);
    console.log("- Base URL:", req.baseUrl);
    console.log("- Path:", req.path);
    console.log("- Headers:", req.headers);
    console.log("- Query:", req.query);
    next();
  });

  // Improved error handling for unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
    // Application continues running despite unhandled promise rejections
  });

  // Global error handler for uncaught exceptions
  process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    // Log the error but don't exit the process
  });

  // Error handling middleware - improved with more specific error types
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    // Log the error for debugging
    console.error("Application error:", err);
    console.error("Request URL:", req.originalUrl);
    console.error("Request method:", req.method);

    const status = err.status || err.statusCode || 500;
    let message = err.message || "Internal Server Error";

    // Database connection errors
    if (
      err.code &&
      (err.code.startsWith("57") ||
        err.code === "08006" ||
        err.code === "08001")
    ) {
      message = "Database service unavailable. Please try again later.";
      log(`Database connection error: ${err.message}`, "error");
    } else {
      log(`Error: ${err.message}`, "error");
    }

    // Ensure JSON response for API routes
    if (req.originalUrl.startsWith("/api")) {
      res.setHeader("Content-Type", "application/json");
    }

    res.status(status).json({
      success: false,
      message,
      error: err.message,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    });
    // DO NOT throw error here as it will crash the application
  });

  // Ensure API routes are registered BEFORE any static file serving
  console.log("API routes registered, setting up static serving...");

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    // Serve static files from client/dist (AFTER API routes)
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`, "express");

      // Start automatic file cleanup service
      const fileCleanup = FileCleanupService.getInstance();
      fileCleanup.startAutoCleanup();
      log("File cleanup service started", "express");

      if (process.env.KAFKA_ENABLED === "true") {
        setupKafkaConsumer()
          .then(() => log("Kafka consumer started successfully", "kafka"))
          .catch((err) =>
            log(`Failed to start Kafka consumer: ${err}`, "kafka-error"),
          );
      } else {
        log(
          "Kafka consumer disabled. Set KAFKA_ENABLED=true to enable.",
          "kafka",
        );
      }
    },
  );

  // Xử lý tắt ứng dụng
  const shutdown = async () => {
    log("Shutting down server...", "app");

    // Đóng Kafka consumer nếu đang chạy
    if (process.env.KAFKA_ENABLED === "true") {
      await disconnectKafkaConsumer().catch((err) =>
        log(`Error disconnecting Kafka consumer: ${err}`, "kafka-error"),
      );
    }

    // Đóng server
    server.close(() => {
      log("Server closed", "app");
      process.exit(0);
    });

    // Nếu server không đóng trong 5 giây, thoát cưỡng bức
    setTimeout(() => {
      log("Server close timeout, forcing exit", "app");
      process.exit(1);
    }, 5000);
  };

  // Xử lý các sự kiện thoát
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  // Start the comment queue processor INSIDE the async function
  import("./comment-queue-processor")
    .then(() => {
      console.log("🚀 CommentQueueProcessor initialized and started");
    })
    .catch((error) => {
      console.error("❌ Failed to initialize CommentQueueProcessor:", error);
    });
})();

// Import routes
import "./routes.js";

// Debug logging for routes
console.log("Report management routes loaded");
