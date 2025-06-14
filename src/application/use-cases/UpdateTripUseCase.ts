import { ITripRepository } from '../../domain/repositories/ITripRepository';
import { UpdateTripDTO, TripDTO } from '../dto/TripDTO';
import { TripMapper } from '../mappers/TripMapper';
import { TripNotFoundError, ValidationError, UnauthorizedAccessError } from '../../domain/errors/DomainError';

export class UpdateTripUseCase {
  constructor(
    private readonly tripRepository: ITripRepository,
    private readonly tripMapper: TripMapper
  ) {}

  async execute(dto: UpdateTripDTO, userId: string): Promise<TripDTO> {
    if (!dto.id?.trim()) {
      throw new ValidationError('id', 'Trip ID is required');
    }

    if (!userId?.trim()) {
      throw new ValidationError('userId', 'User ID is required');
    }

    const trip = await this.tripRepository.findById(dto.id);

    if (!trip) {
      throw new TripNotFoundError(dto.id);
    }

    if (trip.userId.value !== userId) {
      throw new UnauthorizedAccessError(`trip ${dto.id}`);
    }

    // Update trip properties
    if (dto.name !== undefined) {
      if (!dto.name.trim()) {
        throw new ValidationError('name', 'Trip name cannot be empty');
      }
      trip.updateName(dto.name);
    }

    if (dto.destination !== undefined) {
      if (!dto.destination.trim()) {
        throw new ValidationError('destination', 'Trip destination cannot be empty');
      }
      trip.updateDestination(dto.destination);
    }

    await this.tripRepository.save(trip);

    return this.tripMapper.toDTO(trip);
  }
}