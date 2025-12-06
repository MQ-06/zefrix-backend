// api/_cors.js - Simplified CORS handler
export function setCORSHeaders(req, res) {
  const allowedOrigins = [
    'https://zefrix-final.webflow.io',
    'https://zefrix-final.design.webflow.com',
    'http://localhost:3000',
    'http://localhost:8080',
  ];
  
  const origin = req.headers.origin;
  
  // If origin is in allowed list, use it; otherwise allow all (*)
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.setHeader("Access-Control-Allow-Credentials", "true");
}
