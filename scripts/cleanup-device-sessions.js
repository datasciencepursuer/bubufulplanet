#!/usr/bin/env node

/**
 * Device Session Cleanup Script for Coolify Cron
 * 
 * This script optimizes database storage by:
 * 1. Removing expired sessions (past expiresAt + grace period)
 * 2. Cleaning up idle sessions that exceeded max idle time
 * 3. Removing old inactive sessions (90+ days)
 * 4. Enforcing per-device session limits (5 most recent per device)
 * 5. Cleaning up orphaned devices with no active sessions
 * 
 * Usage: node scripts/cleanup-device-sessions.js
 * Recommended schedule: Daily at 2 AM (0 2 * * *)
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function cleanupExpiredSessions() {
  const startTime = new Date();
  console.log(`[${startTime.toISOString()}] 🧹 Starting device session cleanup...`);
  
  try {
    const now = new Date();
    const stats = {
      expiredSessions: 0,
      inactiveSessions: 0,
      orphanedDevices: 0,
      idleSessions: 0,
      limitEnforced: 0,
      errors: []
    };

    // 1. Delete hard-expired sessions (past expiresAt + 7 day grace period)
    console.log('🗑️  Cleaning expired sessions...');
    const gracePeriod = 7 * 24 * 60 * 60 * 1000; // 7 days
    try {
      const expiredResult = await prisma.deviceSession.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(now.getTime() - gracePeriod)
          }
        }
      });
      stats.expiredSessions = expiredResult.count;
      console.log(`   ✅ Deleted ${expiredResult.count} hard-expired sessions`);
    } catch (error) {
      console.error('   ❌ Error deleting expired sessions:', error.message);
      stats.errors.push(`Expired sessions: ${error.message}`);
    }

    // 2. Delete sessions that exceeded idle time
    console.log('⏰ Cleaning idle sessions...');
    try {
      const idleSessionsResult = await prisma.$executeRaw`
        DELETE FROM device_sessions 
        WHERE is_active = true 
        AND (EXTRACT(EPOCH FROM (NOW() - last_used)) > max_idle_time)
      `;
      stats.idleSessions = Number(idleSessionsResult);
      console.log(`   ✅ Deleted ${idleSessionsResult} idle sessions`);
    } catch (error) {
      console.error('   ❌ Error deleting idle sessions:', error.message);
      stats.errors.push(`Idle sessions: ${error.message}`);
    }

    // 3. Delete old inactive sessions (90+ days old)
    console.log('🗄️  Cleaning old inactive sessions...');
    try {
      const inactiveResult = await prisma.deviceSession.deleteMany({
        where: {
          isActive: false,
          lastUsed: {
            lt: new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000))
          }
        }
      });
      stats.inactiveSessions = inactiveResult.count;
      console.log(`   ✅ Deleted ${inactiveResult.count} old inactive sessions`);
    } catch (error) {
      console.error('   ❌ Error deleting inactive sessions:', error.message);
      stats.errors.push(`Inactive sessions: ${error.message}`);
    }

    // 4. Enforce per-device session limits (keep 5 most recent per device)
    console.log('📊 Enforcing device session limits...');
    try {
      const deviceLimitResult = await prisma.$executeRaw`
        DELETE FROM device_sessions 
        WHERE id NOT IN (
          SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (
              PARTITION BY device_fingerprint 
              ORDER BY last_used DESC
            ) as rn
            FROM device_sessions 
            WHERE is_active = true
          ) ranked 
          WHERE rn <= 5
        ) AND is_active = true
      `;
      stats.limitEnforced = Number(deviceLimitResult);
      console.log(`   ✅ Enforced device session limits: ${deviceLimitResult} excess sessions removed`);
    } catch (error) {
      console.error('   ❌ Error enforcing device limits:', error.message);
      stats.errors.push(`Device limits: ${error.message}`);
    }

    // 5. Clean up orphaned devices (no active sessions, older than 30 days)
    console.log('🏴‍☠️  Cleaning orphaned devices...');
    try {
      const orphanedDevices = await prisma.device.findMany({
        where: {
          deviceSessions: {
            none: {
              isActive: true
            }
          },
          createdAt: {
            lt: new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000))
          }
        },
        select: { fingerprint: true }
      });

      if (orphanedDevices.length > 0) {
        const deviceDeleteResult = await prisma.device.deleteMany({
          where: {
            fingerprint: {
              in: orphanedDevices.map(d => d.fingerprint)
            }
          }
        });
        stats.orphanedDevices = deviceDeleteResult.count;
        console.log(`   ✅ Deleted ${deviceDeleteResult.count} orphaned devices`);
      } else {
        console.log('   ✅ No orphaned devices found');
      }
    } catch (error) {
      console.error('   ❌ Error cleaning orphaned devices:', error.message);
      stats.errors.push(`Orphaned devices: ${error.message}`);
    }

    // 6. Log cleanup statistics
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    const totalCleaned = stats.expiredSessions + stats.inactiveSessions + stats.idleSessions + stats.limitEnforced;
    
    console.log('\n' + '='.repeat(60));
    console.log(`🏁 Cleanup completed in ${duration}ms`);
    console.log('📈 Statistics:');
    console.log(`   • Expired sessions: ${stats.expiredSessions}`);
    console.log(`   • Idle sessions: ${stats.idleSessions}`);
    console.log(`   • Inactive sessions: ${stats.inactiveSessions}`);
    console.log(`   • Limit-enforced removals: ${stats.limitEnforced}`);
    console.log(`   • Orphaned devices: ${stats.orphanedDevices}`);
    console.log(`   • Total sessions cleaned: ${totalCleaned}`);
    
    if (stats.errors.length > 0) {
      console.log('⚠️  Errors encountered:');
      stats.errors.forEach(error => console.log(`   • ${error}`));
    }

    // 7. Log to database for monitoring (if cleanup_log table exists)
    try {
      await prisma.cleanupLog.create({
        data: {
          tableName: 'device_sessions',
          deletedCount: totalCleaned,
          details: {
            ...stats,
            duration: duration,
            timestamp: endTime.toISOString()
          },
          cleanedAt: endTime
        }
      });
      console.log('✅ Cleanup stats logged to database');
    } catch (logError) {
      console.warn('⚠️  Could not log to cleanup_log table:', logError.message);
    }

    // 8. Get current session counts for monitoring
    try {
      const activeSessions = await prisma.deviceSession.count({
        where: { isActive: true }
      });
      const totalDevices = await prisma.device.count();
      
      console.log('📊 Current state:');
      console.log(`   • Active sessions: ${activeSessions}`);
      console.log(`   • Total devices: ${totalDevices}`);
    } catch (error) {
      console.warn('⚠️  Could not fetch current state:', error.message);
    }

    console.log('='.repeat(60));
    
    return {
      success: true,
      stats,
      duration,
      timestamp: endTime.toISOString()
    };

  } catch (error) {
    const endTime = new Date();
    console.error(`[${endTime.toISOString()}] ❌ Cleanup failed:`, error);
    
    // Try to log the failure
    try {
      await prisma.cleanupLog.create({
        data: {
          tableName: 'device_sessions',
          deletedCount: 0,
          details: {
            error: error.message,
            stack: error.stack,
            timestamp: endTime.toISOString()
          },
          cleanedAt: endTime
        }
      });
    } catch (logError) {
      console.error('Could not log cleanup failure:', logError.message);
    }
    
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run cleanup if called directly
if (require.main === module) {
  cleanupExpiredSessions()
    .then((result) => {
      console.log('\n🎉 Cleanup script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Cleanup script failed:', error);
      process.exit(1);
    });
}

module.exports = { cleanupExpiredSessions };