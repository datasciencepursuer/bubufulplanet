#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkCleanupLogs() {
  try {
    console.log('📊 Recent cleanup logs:');
    
    const logs = await prisma.cleanupLog.findMany({
      orderBy: { cleanedAt: 'desc' },
      take: 5
    });
    
    if (logs.length === 0) {
      console.log('No cleanup logs found.');
      return;
    }
    
    logs.forEach((log, index) => {
      console.log(`\n${index + 1}. ${log.cleanedAt.toISOString()}`);
      console.log(`   Table: ${log.tableName}`);
      console.log(`   Deleted: ${log.deletedCount} records`);
      if (log.details) {
        console.log(`   Details:`, JSON.stringify(log.details, null, 2));
      }
    });
    
    console.log('\n✅ Query completed');
    
  } catch (error) {
    console.error('❌ Error querying cleanup logs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCleanupLogs();