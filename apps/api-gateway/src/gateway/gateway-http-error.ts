/** A gateway-level failure, formatted the same way AllExceptionsFilter shapes every other service's errors. */
export class GatewayHttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly error: string,
    message: string,
  ) {
    super(message);
  }

  toBody(path: string) {
    return {
      statusCode: this.statusCode,
      error: this.error,
      message: this.message,
      path,
      timestamp: new Date().toISOString(),
    };
  }
}
