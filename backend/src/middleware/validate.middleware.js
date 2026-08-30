import { badRequest } from "../utils/api-error.js";

const validate = (property) => (schema) => (req, _res, next) => {
  const result = schema.safeParse(req[property]);

  if (!result.success) {
    return next(badRequest("Validation failed", result.error.flatten().fieldErrors));
  }

  req[property] = result.data;
  return next();
};

export const validateBody = validate("body");
export const validateQuery = validate("query");
export const validateParams = validate("params");
