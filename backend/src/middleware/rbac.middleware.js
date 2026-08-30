import { forbidden, unauthorized } from "../utils/api-error.js";

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized("Not authenticated"));
    if (!roles.includes(req.user.role)) return next(forbidden());
    return next();
  };
}
