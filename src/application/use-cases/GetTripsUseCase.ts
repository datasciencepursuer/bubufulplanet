import { ITripRepository } from '../../domain/repositories/ITripRepository';
import { UserId } from '../../domain/value-objects/UserId';
import { TripListDTO } from '../dto/TripDTO';
import { TripMapper } from '../mappers/TripMapper';
import { ValidationError } from '../../domain/errors/DomainError';

export class GetTripsUseCase {
  constructor(
    private readonly tripRepository: ITripRepository,
    private readonly tripMapper: TripMapper
  ) {}

  async execute(userId: string): Promise<TripListDTO[]> {
    if (!userId?.trim()) {
      throw new ValidationError('userId', 'User ID is required');
    }

    const userIdVO = new UserId(userId);
    const trips = await this.tripRepository.findByUserId(userIdVO);

    return trips.map(trip => this.tripMapper.toListDTO(trip));
  }
}