import { NextRequest, NextResponse } from 'next/server';
import { DomainError } from '../../domain/errors/DomainError';
import { validateUnifiedSession, type UnifiedSessionContext } from '@/lib/unified-session';

export abstract class BaseController {
  protected async handleRequest<T>(
    request: NextRequest,
    handler: (request: NextRequest) => Promise<T>
  ): Promise<NextResponse> {
    try {
      const result = await handler(request);
      return NextResponse.json(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  protected async handleRequestWithAuth<T>(
    request: NextRequest,
    handler: (request: NextRequest, userId: string) => Promise<T>
  ): Promise<NextResponse> {
    try {
      const userId = this.extractUserId(request);
      if (!userId) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      const result = await handler(request, userId);
      return NextResponse.json(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  protected async handleRequestWithGroupAuth<T>(
    request: NextRequest,
    handler: (request: NextRequest, context: UnifiedSessionContext) => Promise<T>
  ): Promise<NextResponse> {
    try {
      const validation = await validateUnifiedSession();
      if (!validation.isValid || !validation.context) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      const result = await handler(request, validation.context);
      return NextResponse.json(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  protected extractUserId(request: NextRequest): string | null {
    // Extract user ID from cookies or headers based on your auth implementation
    // This is a placeholder - adjust based on your authentication mechanism
    const cookies = request.cookies;
    return cookies.get('vacation-planner-user-id')?.value || null;
  }

  protected handleError(error: unknown): NextResponse {
    console.error('API Error:', error);

    if (error instanceof DomainError) {
      return NextResponse.json(
        { 
          error: error.message,
          code: error.code 
        },
        { status: error.statusCode }
      );
    }

    // Handle other types of errors
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }

  protected async parseBody<T>(request: NextRequest): Promise<T> {
    try {
      return await request.json();
    } catch (error) {
      throw new Error('Invalid JSON body');
    }
  }

  protected getQueryParam(request: NextRequest, param: string): string | null {
    const { searchParams } = new URL(request.url);
    return searchParams.get(param);
  }
}