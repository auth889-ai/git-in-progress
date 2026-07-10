const jwt = require("jsonwebtoken");

// Verifies a "Bearer <token>" Authorization header and puts the
// decoded payload on req.user. Apply to any route that needs auth.
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication token missing!" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token!" });
  }
}

module.exports = authMiddleware;
