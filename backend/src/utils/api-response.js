export class ApiResponse {
  constructor(statusCode, data = null, message = "Success") {
    this.success = statusCode < 400;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
  }
}

export const ok = (res, data, message = "Success") =>
  res.status(200).json(new ApiResponse(200, data, message));

export const created = (res, data, message = "Created") =>
  res.status(201).json(new ApiResponse(201, data, message));
