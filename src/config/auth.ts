/**
 * Authentication Configuration
 * Centralized configuration for all authentication-related settings
 */

export const authConfig = {
  // OAuth Providers Configuration
  providers: {
    google: {
      enabled: true,
      scopes: ['email', 'profile'],
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      }
    },
    github: {
      enabled: true,
      scopes: ['read:user', 'user:email']
    }
  },

  // Redirect URLs
  redirects: {
    afterLogin: '/app',
    afterLogout: '/login',
    callback: '/auth/callback',
    unauthorized: '/login'
  },

  // Session Configuration
  session: {
    maxGroups: 5,  // Maximum number of groups per user
    defaultRole: 'member',
    leaderRole: 'leader'
  },

  // Group Settings
  groups: {
    defaultPermissions: {
      member: {
        read: true,
        create: true,
        modify: false
      },
      leader: {
        read: true,
        create: true,
        modify: true
      }
    }
  },

  // UI Messages
  messages: {
    loginError: 'Failed to authenticate. Please try again.',
    logoutError: 'Failed to sign out. Please try again.',
    unauthorized: 'Please sign in to continue.',
    sessionExpired: 'Your session has expired. Please sign in again.',
    maxGroupsReached: 'You have reached the maximum number of groups (5).',
    invitationSent: 'Invitation sent successfully.',
    invitationFailed: 'Failed to send invitation. Please try again.'
  }
}

// Helper function to get redirect URL
export function getRedirectUrl(type: keyof typeof authConfig.redirects) {
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  
  return `${baseUrl}${authConfig.redirects[type]}`
}

// Helper function to check if provider is enabled
export function isProviderEnabled(provider: keyof typeof authConfig.providers) {
  return authConfig.providers[provider]?.enabled ?? false
}