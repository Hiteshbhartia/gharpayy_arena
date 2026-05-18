import jwt from "jsonwebtoken";

/** Build a JWT-safe payload (plain strings only). */
export function tokenPayload(user) {
  return {
    id: String(user._id ?? user.id),
    role: user.role,
    ...(user.employeeId ? { employeeId: String(user.employeeId) } : {}),
  };
}

export function signToken(userOrPayload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const err = new Error("JWT_SECRET is not configured");
    err.status = 500;
    throw err;
  }

  const payload =
    userOrPayload.id && userOrPayload.role && !userOrPayload._id
      ? userOrPayload
      : tokenPayload(userOrPayload);

  try {
    return jwt.sign(payload, secret, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });
  } catch (err) {
    console.error("[auth] signToken failed:", err.message);
    const e = new Error("Could not issue session token");
    e.status = 500;
    throw e;
  }
}

export function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing token" });

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("[auth] JWT_SECRET missing on authenticated request");
      return res.status(500).json({ error: "Auth is not configured" });
    }

    const decoded = jwt.verify(token, secret);
    req.user = {
      id: String(decoded.id),
      role: decoded.role,
      ...(decoded.employeeId ? { employeeId: String(decoded.employeeId) } : {}),
    };
    next();
  } catch (err) {
    console.warn("[auth] requireAuth rejected token:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
