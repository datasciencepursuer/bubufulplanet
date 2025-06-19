/**
 * Session Configuration and Lifespan Management
 * 
 * This module handles session lifespan calculations, validation, and type definitions
 * for the enhanced device session system.
 */

export const SESSION_LIFESPANS = {
  // Short session for quick access
  temporary: {
    maxAge: 24 * 60 * 60 * 1000,      // 24 hours
    maxIdle: 4 * 60 * 60 * 1000,      // 4 hours idle
    description: 'Short-term session for quick access'
  },
  // Default session type for most users
  remember_device: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    maxIdle: 7 * 24 * 60 * 60 * 1000, // 7 days idle
    description: 'Standard device session with auto-login'
  },
  // Extended session for trusted devices
  long_term: {
    maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
    maxIdle: 30 * 24 * 60 * 60 * 1000, // 30 days idle
    description: 'Extended session for trusted devices'
  }
} as const;

export type SessionType = keyof typeof SESSION_LIFESPANS;

/**
 * Calculate session expiry times based on session type
 */
export function calculateSessionExpiry(type: SessionType): {
  expiresAt: Date;
  maxIdleTime: number;
} {
  const config = SESSION_LIFESPANS[type];
  const now = new Date();
  
  return {
    expiresAt: new Date(now.getTime() + config.maxAge),
    maxIdleTime: Math.floor(config.maxIdle / 1000), // Convert to seconds for DB storage
  };
}

/**
 * Check if a session is still valid based on expiry and idle time
 */
export function isSessionValid(session: {
  expiresAt: Date;
  maxIdleTime: number;
  lastUsed: Date;
  isActive: boolean;
}): boolean {
  const now = new Date();
  const idleTime = now.getTime() - session.lastUsed.getTime();
  
  return (
    session.isActive &&
    now < session.expiresAt &&
    idleTime < (session.maxIdleTime * 1000) // Convert back to milliseconds
  );
}

/**
 * Get session expiry info for display purposes
 */
export function getSessionExpiryInfo(session: {
  expiresAt: Date;
  maxIdleTime: number;
  lastUsed: Date;
  sessionType?: string;
}): {
  isExpiringSoon: boolean;
  daysUntilExpiry: number;
  timeUntilIdleExpiry: number;
  sessionTypeName: string;
} {
  const now = new Date();
  const timeUntilExpiry = session.expiresAt.getTime() - now.getTime();
  const timeSinceLastUsed = now.getTime() - session.lastUsed.getTime();
  const timeUntilIdleExpiry = (session.maxIdleTime * 1000) - timeSinceLastUsed;
  
  const daysUntilExpiry = Math.max(0, Math.floor(timeUntilExpiry / (24 * 60 * 60 * 1000)));
  const isExpiringSoon = daysUntilExpiry <= 7; // Within 7 days
  
  const sessionType = (session.sessionType as SessionType) || 'remember_device';
  const sessionTypeName = SESSION_LIFESPANS[sessionType]?.description || 'Unknown session type';
  
  return {
    isExpiringSoon,
    daysUntilExpiry,
    timeUntilIdleExpiry: Math.max(0, timeUntilIdleExpiry),
    sessionTypeName
  };
}

/**
 * Update session last used timestamp
 */
export function updateSessionActivity(sessionId: string) {
  // This would typically be called by middleware or session validation
  // Implementation depends on how you want to batch these updates
  return {
    sessionId,
    lastUsed: new Date(),
    updateQuery: {
      where: { id: sessionId },
      data: { lastUsed: new Date() }
    }
  };
}

/**
 * Default session configuration based on user preferences
 */
export function getDefaultSessionType(preferences?: {
  rememberDevice?: boolean;
  trustedDevice?: boolean;
}): SessionType {
  if (preferences?.trustedDevice) {
    return 'long_term';
  }
  if (preferences?.rememberDevice !== false) {
    return 'remember_device';
  }
  return 'temporary';
}

/**
 * Session cleanup configuration
 */
export const CLEANUP_CONFIG = {
  // Grace period before hard deletion of expired sessions
  gracePeriodDays: 7,
  
  // Maximum inactive session age before cleanup
  maxInactiveAgeDays: 90,
  
  // Maximum sessions per device
  maxSessionsPerDevice: 5,
  
  // Minimum age for orphaned device cleanup
  orphanedDeviceAgeDays: 30,
} as const;

/**
 * Calculate if cleanup should run based on last cleanup time
 */
export function shouldRunCleanup(lastCleanup?: Date): boolean {
  if (!lastCleanup) return true;
  
  const now = new Date();
  const timeSinceLastCleanup = now.getTime() - lastCleanup.getTime();
  const cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours
  
  return timeSinceLastCleanup >= cleanupInterval;
}

/**
 * Type definitions for enhanced device sessions
 */
export interface EnhancedDeviceSession {
  id: string;
  deviceFingerprint: string;
  groupId: string;
  currentTravelerName: string;
  availableTravelers?: string[];
  sessionType: SessionType;
  expiresAt: Date;
  maxIdleTime: number;
  sessionData?: Record<string, any>;
  userAgent?: string;
  ipAddress?: string;
  isActive: boolean;
  lastUsed: Date;
  createdAt: Date;
}

export interface DeviceInfo {
  fingerprint: string;
  userAgent?: string;
  screen?: string;
  timezone?: string;
  language?: string;
  platform?: string;
  createdAt: Date;
  updatedAt: Date;
}