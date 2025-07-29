#!/usr/bin/env node

const Database = require('../database/database');

async function initializeDatabase() {
    console.log('🔄 Initializing Email Checker Database...');
    
    const db = new Database();
    
    try {
        await db.init();
        console.log('✅ Database initialized successfully!');
        console.log('🚀 You can now start the application with: npm start');
    } catch (error) {
        console.error('❌ Failed to initialize database:', error);
        process.exit(1);
    } finally {
        db.close();
    }
}

// Run if called directly
if (require.main === module) {
    initializeDatabase();
}

module.exports = initializeDatabase;
