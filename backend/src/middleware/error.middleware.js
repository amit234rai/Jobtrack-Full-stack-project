import { ApiError } from "../utils/api-error.js";

export function notFound(req, _res, next) {
  next(new ApiError(404, `No route found for ${req.method} ${req.path}`));
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    console.warn(`[${err.statusCode}] ${err.message}`);
    return res.status(err.statusCode).json(err.toJSON());
  }

  console.error("Unexpected error:", err);

  return res.status(500).json({
    success: false,
    statusCode: 500,
    error: "Internal server error",
  });
}
