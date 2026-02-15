export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly data?: unknown;

  constructor(
    message: string,
    status: number,
    code: string,
    data?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export function badRequest(message: string): AppError {
  return new AppError(message, 400, 'BAD_REQUEST');
}

export function unauthorized(message: string): AppError {
  return new AppError(message, 401, 'UNAUTHORIZED');
}

export function forbidden(message: string): AppError {
  return new AppError(message, 403, 'FORBIDDEN');
}

export function notFound(message: string): AppError {
  return new AppError(message, 404, 'NOT_FOUND');
}

export function conflict(message: string, data?: unknown): AppError {
  return new AppError(message, 409, 'CONFLICT', data);
}

export function payloadTooLarge(message: string, data?: unknown): AppError {
  return new AppError(message, 413, 'QUOTA_EXCEEDED', data);
}

export function tooManyRequests(message: string): AppError {
  return new AppError(message, 429, 'TOO_MANY_REQUESTS');
}

export function internal(message: string): AppError {
  return new AppError(message, 500, 'INTERNAL_ERROR');
}
