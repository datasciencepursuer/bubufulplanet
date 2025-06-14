import { ITripRepository } from '../../domain/repositories/ITripRepository';
import { TripDTO } from '../dto/TripDTO';
import { TripMapper } from '../mappers/TripMapper';
import { TripNotFoundError, ValidationError, UnauthorizedAccessError } from '../../domain/errors/DomainError';

export class GetTripByIdUseCase {
  constructor(
    private readonly tripRepository: ITripRepository,
    private readonly tripMapper: TripMapper
  ) {}

  async execute(tripId: string, userId: string): Promise<TripDTO> {
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

    return this.tripMapper.toDTO(trip);
  }
}