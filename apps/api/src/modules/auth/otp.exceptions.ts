import { HttpException, HttpStatus } from '@nestjs/common';

export class TooManyRequestsException extends HttpException {
  constructor(message = 'Too many requests') {
    super({ statusCode: HttpStatus.TOO_MANY_REQUESTS, error: 'TooManyRequests', message }, HttpStatus.TOO_MANY_REQUESTS);
  }
}
