import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import createError from "http-errors";
import { rateLimit } from "express-rate-limit";
import UAParser from "ua-parser-js";
import { apiRouter } from "./routers/routers.js";

const app = express();

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  handler: (req, res) => {
    res
      .status(429)
      .json({ success: false, message: "Too many requests, try again later." });
  },
});

//middleware
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://restaurant-management-ui.vercel.app",
      "https://restaurantmanagement-aac4e.web.app",
    ],
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

app.use(morgan("dev"));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Enhanced Helmet Security Configuration
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "https://trusted-scripts.com"],
        "style-src": [
          "'self'",
          "'unsafe-inline'",
          "https://trusted-styles.com",
        ],
        "img-src": ["'self'", "data:", "https://trusted-images.com"],
        "connect-src": ["'self'", "https://trusted-api.com"],
        // Add more directives as needed
      },
    },
    frameguard: { action: "deny" }, // Prevents clickjacking
    hsts: { maxAge: 31536000, includeSubDomains: true }, // Enforces HTTPS
    noSniff: true, // Prevents MIME type sniffing
    referrerPolicy: { policy: "no-referrer" }, // Restricts referrer information
    xssFilter: true, // Mitigates cross-site scripting (XSS) attacks
    dnsPrefetchControl: { allow: false }, // Disables DNS prefetching
    expectCt: { enforce: true, maxAge: 86400 }, // Enables Certificate Transparency
    permittedCrossDomainPolicies: { permittedPolicies: "none" }, // Restricts Adobe Flash and PDF files
  })
);

// Remove "X-Powered-By" header
app.disable("x-powered-by");

// routes
app.use("/api/v2", apiRouter);

app.get("/", (req, res) => {
  const userAgent = req.headers["user-agent"];
  const parser = new UAParser();
  const result = parser.setUA(userAgent).getResult();

  // Extract browser and device information
  const browser = result?.browser?.name
    ? result?.browser?.name
    : result?.ua || "Unknown";
  const device = userAgent?.includes("Mobile") ? "Mobile" : "Desktop";
  const os = { name: result?.os?.name, version: result?.os?.version };
  res.status(200).send({
    success: true,
    message: "Server is running",
    browser: browser,
    device: device,
    operatingSystem: os,
  });
});

//client error handling
app.use((req, res, next) => {
  next(createError(404, "Route not found!"));
});

//server error handling
app.use((err, req, res, next) => {
  return res.status(err.status || 500).json({
    success: false,
    message: err.message,
  });
});

export default app;
