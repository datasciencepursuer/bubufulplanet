import { ITripRepository } from '../../domain/repositories/ITripRepository';
import { TripNotFoundError, ValidationError, UnauthorizedAccessError } from '../../domain/errors/DomainError';

export class DeleteTripUseCase {
  constructor(
    private readonly tripRepository: ITripRepository
  ) {}

  async execute(tripId: string, userId: string): Promise<void> {
    if (!tripId?.trim()) {
      throw new ValidationError('tripId', 'Trip ID is required');
    }

    if (!userId?.trim()) {
      throw new ValidationError('userId', 'User ID is required');
    }

    const trip = await this.tripRepository.findById(tripId);

    if (!trip) {
      throw new TripNotFoundError(tripId);
    }

    if (trip.userId.value !== userId) {
      throw new UnauthorizedAccessError(`trip ${tripId}`);
    }

    await this.tripRepository.delete(tripId);
  }
}