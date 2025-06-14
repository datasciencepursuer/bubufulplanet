import { ITripRepository } from '../../domain/repositories/ITripRepository';
import { ITripDayRepository } from '../../domain/repositories/ITripDayRepository';
import { Trip } from '../../domain/entities/Trip';
import { TripDay } from '../../domain/entities/TripDay';
import { DateRange } from '../../domain/value-objects/DateRange';
import { UserId } from '../../domain/value-objects/UserId';
import { CreateTripDTO, TripDTO } from '../dto/TripDTO';
import { TripMapper } from '../mappers/TripMapper';
import { ValidationError } from '../../domain/errors/DomainError';
import { randomUUID } from 'crypto';

export class CreateTripUseCase {
  constructor(
    private readonly tripRepository: ITripRepository,
    private readonly tripDayRepository: ITripDayRepository,
    private readonly tripMapper: TripMapper
  ) {}

  async execute(dto: CreateTripDTO): Promise<TripDTO> {
    this.validateInput(dto);

    const dateRange = new DateRange(
      new Date(dto.startDate),
      new Date(dto.endDate)
    );
    const userId = new UserId(dto.userId);

    const trip = new Trip(
      randomUUID(),
      dto.name,
      dto.destination,
      dateRange,
      userId
    );

    // Generate trip days
    const tripDays = this.generateTripDays(trip.id, dateRange);
    tripDays.forEach(day => trip.addDay(day));

    // Save trip and days
    await this.tripRepository.save(trip);

    return this.tripMapper.toDTO(trip);
  }

  private validateInput(dto: CreateTripDTO): void {
    if (!dto.name?.trim()) {
      throw new ValidationError('name', 'Trip name is required');
    }

    if (!dto.destination?.trim()) {
      throw new ValidationError('destination', 'Trip destination is required');
    }

    if (!dto.startDate) {
      throw new ValidationError('startDate', 'Start date is required');
    }

    if (!dto.endDate) {
      throw new ValidationError('endDate', 'End date is required');
    }

    if (!dto.userId?.trim()) {
      throw new ValidationError('userId', 'User ID is required');
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (isNaN(startDate.getTime())) {
      throw new ValidationError('startDate', 'Invalid start date format');
    }

    if (isNaN(endDate.getTime())) {
      throw new ValidationError('endDate', 'Invalid end date format');
    }

    if (startDate > endDate) {
      throw new ValidationError('dateRange', 'Start date cannot be after end date');
    }
  }

  private generateTripDays(tripId: string, dateRange: DateRange): TripDay[] {
    const days: TripDay[] = [];
    const current = new Date(dateRange.startDate);
    let dayNumber = 1;

    while (current <= dateRange.endDate) {
      days.push(new TripDay(
        randomUUID(),
        tripId,
        dayNumber,
        new Date(current)
      ));
      
      current.setDate(current.getDate() + 1);
      dayNumber++;
    }

    return days;
  }
}