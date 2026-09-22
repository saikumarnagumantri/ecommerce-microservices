import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

interface ErrorBody {
  message?: unknown;
  error?: unknown;
}

/**
 * Normalizes every error response (validation failures, thrown
 * HttpExceptions, uncaught errors) to one shape across all services, and
 * logs the stack for anything that reaches the client as a 5xx.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttpException
      ? (exception.getResponse() as string | ErrorBody)
      : undefined;

    const message =
      typeof body === 'string'
        ? body
        : (body?.message ??
          (exception instanceof Error ? exception.message : null) ??
          'Internal server error');

    const error =
      (typeof body === 'object' ? body?.error : undefined) ??
      HttpStatus[status] ??
      'Error';

    if (status >= 500) {
      this.logger.error(
        `${request?.method ?? ''} ${request?.url ?? ''}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      path: request?.url,
      timestamp: new Date().toISOString(),
    });
  }
}
