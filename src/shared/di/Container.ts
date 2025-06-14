import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../types/database';

// Repositories
import { ITripRepository } from '../../domain/repositories/ITripRepository';
import { ITripDayRepository } from '../../domain/repositories/ITripDayRepository';
import { SupabaseTripRepository } from '../../infrastructure/repositories/SupabaseTripRepository';

// Use Cases
import { CreateTripUseCase } from '../../application/use-cases/CreateTripUseCase';
import { GetTripsUseCase } from '../../application/use-cases/GetTripsUseCase';
import { GetTripByIdUseCase } from '../../application/use-cases/GetTripByIdUseCase';
import { UpdateTripUseCase } from '../../application/use-cases/UpdateTripUseCase';
import { DeleteTripUseCase } from '../../application/use-cases/DeleteTripUseCase';

// Mappers
import { TripMapper } from '../../application/mappers/TripMapper';

export class DIContainer {
  private static instance: DIContainer;
  private services: Map<string, any> = new Map();

  private constructor() {}

  static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  register<T>(key: string, factory: () => T): void {
    this.services.set(key, factory);
  }

  get<T>(key: string): T {
    const factory = this.services.get(key);
    if (!factory) {
      throw new Error(`Service not found: ${key}`);
    }
    return factory();
  }

  initialize(supabase: SupabaseClient<Database>): void {
    // Register repositories
    this.register<ITripRepository>('ITripRepository', () => 
      new SupabaseTripRepository(supabase)
    );

    // Register mappers
    this.register<TripMapper>('TripMapper', () => new TripMapper());

    // Register use cases
    this.register<CreateTripUseCase>('CreateTripUseCase', () => 
      new CreateTripUseCase(
        this.get<ITripRepository>('ITripRepository'),
        this.get<ITripDayRepository>('ITripDayRepository'),
        this.get<TripMapper>('TripMapper')
      )
    );

    this.register<GetTripsUseCase>('GetTripsUseCase', () => 
      new GetTripsUseCase(
        this.get<ITripRepository>('ITripRepository'),
        this.get<TripMapper>('TripMapper')
      )
    );

    this.register<GetTripByIdUseCase>('GetTripByIdUseCase', () => 
      new GetTripByIdUseCase(
        this.get<ITripRepository>('ITripRepository'),
        this.get<TripMapper>('TripMapper')
      )
    );

    this.register<UpdateTripUseCase>('UpdateTripUseCase', () => 
      new UpdateTripUseCase(
        this.get<ITripRepository>('ITripRepository'),
        this.get<TripMapper>('TripMapper')
      )
    );

    this.register<DeleteTripUseCase>('DeleteTripUseCase', () => 
      new DeleteTripUseCase(
        this.get<ITripRepository>('ITripRepository')
      )
    );
  }
}