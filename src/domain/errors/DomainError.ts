export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class TripNotFoundError extends DomainError {
  readonly code = 'TRIP_NOT_FOUND';
  readonly statusCode = 404;

  constructor(tripId: string) {
    super(`Trip with id ${tripId} not found`);
  }
}

export class EventNotFoundError extends DomainError {
  readonly code = 'EVENT_NOT_FOUND';
  readonly statusCode = 404;

  constructor(eventId: string) {
    super(`Event with id ${eventId} not found`);
  }
}

export class UnauthorizedAccessError extends DomainError {
  readonly code = 'UNAUTHORIZED_ACCESS';
  readonly statusCode = 403;

  constructor(resource: string) {
    super(`Unauthorized access to ${resource}`);
  }
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;

  constructor(field: string, message: string) {
    super(`Validation error for ${field}: ${message}`);
  }
}