import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { unauthorized } from "../utils/api-error.js";

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return next(unauthorized("Missing or malformed Authorization header"));
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) return next(unauthorized("Missing bearer token"));

  try {
    const { id, email, role } = jwt.verify(token, env.JWT_SECRET);
    req.user = { id, email, role };
    return next();
  } catch (error) {
    const message =
      error.name === "TokenExpiredError" ? "Session expired — please sign in again" : "Invalid token";
    return next(unauthorized(message));
  }
}

export const signToken = ({ id, email, role }) =>
  jwt.sign({ id, email, role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
