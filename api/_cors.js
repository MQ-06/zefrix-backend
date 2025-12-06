// api/_cors.js - CORS helper for handling multiple origins
export function setCORSHeaders(req, res) {
  const origin = req.headers.origin || req.headers.referer || "";
  
  // Allowed origins (add your Webflow domains here)
  const allowedOrigins = [
    "https://zefrix-final.webflow.io",
    "https://zefrix-final.design.webflow.com",
    "http://localhost:3000",
    "http://localhost:8080",
  ];

  // Check if origin is allowed
  const isAllowed = allowedOrigins.some(allowed => origin.includes(allowed)) || 
                    process.env.ALLOWED_ORIGIN === "*" ||
                    !process.env.ALLOWED_ORIGIN;

  // Use environment variable if set, otherwise use origin or wildcard
  const corsOrigin = process.env.ALLOWED_ORIGIN 
    ? (process.env.ALLOWED_ORIGIN === "*" ? "*" : process.env.ALLOWED_ORIGIN)
    : (isAllowed ? origin : "*");

  res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  
  return corsOrigin;
}

