import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import assistantRoutes from "./routes/assistant.routes";
import transferRoutes from "./routes/transfer.routes";
import investingRoutes from "./routes/investing.routes";
import { requireCsrf } from "./middleware/csrf.middleware";
import { getAllowedOrigins } from "./lib/env";

export function createApp() {
  const app = express();
  const allowedOrigins = getAllowedOrigins();

  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    })
  );
  app.use(express.json());

  app.use("/auth", authRoutes);
  app.use(requireCsrf);
  app.use("/assistant", assistantRoutes);
  app.use("/transfers", transferRoutes);
  app.use("/investing", investingRoutes);

  app.get("/", (_req, res) => {
    res.json({ message: "Finapp API is running" });
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  return app;
}
