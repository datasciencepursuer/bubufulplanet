import { NextRequest } from 'next/server';
import { BaseController } from './BaseController';
import { DIContainer } from '../../shared/di/Container';
import { CreateTripUseCase } from '../../application/use-cases/CreateTripUseCase';
import { GetTripsUseCase } from '../../application/use-cases/GetTripsUseCase';
import { GetTripByIdUseCase } from '../../application/use-cases/GetTripByIdUseCase';
import { UpdateTripUseCase } from '../../application/use-cases/UpdateTripUseCase';
import { DeleteTripUseCase } from '../../application/use-cases/DeleteTripUseCase';
import { CreateTripDTO, UpdateTripDTO } from '../../application/dto/TripDTO';

export class TripController extends BaseController {
  private readonly container = DIContainer.getInstance();

  async createTrip(request: NextRequest, userId: string) {
    const body = await this.parseBody<CreateTripDTO>(request);
    const createTripUseCase = this.container.get<CreateTripUseCase>('CreateTripUseCase');
    
    const tripDTO = { ...body, userId };
    return await createTripUseCase.execute(tripDTO);
  }

  async getTrips(request: NextRequest, userId: string) {
    const tripId = this.getQueryParam(request, 'id');
    
    if (tripId) {
      const getTripByIdUseCase = this.container.get<GetTripByIdUseCase>('GetTripByIdUseCase');
      return await getTripByIdUseCase.execute(tripId, userId);
    } else {
      const getTripsUseCase = this.container.get<GetTripsUseCase>('GetTripsUseCase');
      const trips = await getTripsUseCase.execute(userId);
      return { trips };
    }
  }

  async updateTrip(request: NextRequest, userId: string) {
    const body = await this.parseBody<UpdateTripDTO>(request);
    const updateTripUseCase = this.container.get<UpdateTripUseCase>('UpdateTripUseCase');
    
    return await updateTripUseCase.execute(body, userId);
  }

  async deleteTrip(request: NextRequest, userId: string) {
    const tripId = this.getQueryParam(request, 'id');
    if (!tripId) {
      throw new Error('Trip ID is required');
    }

    const deleteTripUseCase = this.container.get<DeleteTripUseCase>('DeleteTripUseCase');
    await deleteTripUseCase.execute(tripId, userId);
    
    return { success: true };
  }
}