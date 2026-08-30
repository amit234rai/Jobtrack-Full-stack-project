export class ApiError extends Error {
  constructor(statusCode, message = "Something went wrong", details = null) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    const hasDetails =
      this.details !== null &&
      this.details !== undefined &&
      Object.keys(this.details).length > 0;

    return {
      success: false,
      statusCode: this.statusCode,
      error: this.message,
      ...(hasDetails ? { details: this.details } : {}),
    };
  }
}

export const badRequest = (message, details) => new ApiError(400, message, details);
export const unauthorized = (message = "Authentication required") => new ApiError(401, message);
export const forbidden = (message = "Insufficient permissions") => new ApiError(403, message);
export const notFoundError = (message = "Resource not found") => new ApiError(404, message);
export const conflict = (message) => new ApiError(409, message);
