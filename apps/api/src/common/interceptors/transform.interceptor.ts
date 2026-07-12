import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: true;
  data: T;
}

/**
 * Wraps successful JSON responses in a { success, data } envelope.
 * Streaming responses (SSE) and raw responses pass through untouched.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | T> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T> | T> {
    const response = context.switchToHttp().getResponse();
    // Skip when the handler already streamed the response (e.g. SSE chat)
    if (response.headersSent) return next.handle();

    return next.handle().pipe(
      map((data) => {
        if (response.headersSent) return data;
        return { success: true as const, data };
      }),
    );
  }
}
