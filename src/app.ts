import express from "express";
import helmet from "helmet";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors());

app.use(
  pinoHttp({
    autoLogging: {
      ignore: (req) => req.url === "/health",
    },

    quietReqLogger: true,
    quietResLogger: true,

    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";

      return "info";
    },

    customSuccessObject: (req, res, { responseTime }) => ({
      method: req.method,
      path: req.url?.split("?")[0],
      statusCode: res.statusCode,
      responseTime,
    }),

    customErrorObject: (req, res, err, { responseTime }) => ({
      method: req.method,
      path: req.url?.split("?")[0],
      statusCode: res.statusCode,
      responseTime,
      err,
    }),
  }),
);

app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use(notFoundHandler);
app.use(errorHandler);
