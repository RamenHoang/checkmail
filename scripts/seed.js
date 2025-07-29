#!/usr/bin/env node

const Database = require('../database/database');

const sampleEmails = [
    'user1@example.com',
    'user2@example.com',
    'user3@example.com',
    'test1@gmail.com',
    'test2@gmail.com',
    'demo1@outlook.com',
    'demo2@outlook.com',
    'sample1@yahoo.com',
    'sample2@yahoo.com',
    'example1@domain.com',
    'example2@domain.com',
    'temp1@tempmail.com',
    'temp2@tempmail.com',
    'random1@email.com',
    'random2@email.com'
];

async function seedDatabase() {
    console.log('🌱 Seeding Email Checker Database...');
    
    const db = new Database();
    
    try {
        await db.init();
        
        let addedCount = 0;
        let skippedCount = 0;
        
        for (const email of sampleEmails) {
            try {
                await db.addEmail(email);
                addedCount++;
                console.log(`✅ Added: ${email}`);
            } catch (error) {
                if (error.code === 'SQLITE_CONSTRAINT') {
                    skippedCount++;
                    console.log(`⏭️  Skipped (exists): ${email}`);
                } else {
                    console.error(`❌ Error adding ${email}:`, error.message);
                }
            }
        }
        
        console.log('\n📊 Seeding Summary:');
        console.log(`✅ Added: ${addedCount} emails`);
        console.log(`⏭️  Skipped: ${skippedCount} emails`);
        console.log(`📧 Total processed: ${sampleEmails.length} emails`);
        
        // Show current stats
        const stats = await db.getStats();
        console.log('\n📈 Current Database Stats:');
        console.log(`Total emails: ${stats.total}`);
        console.log(`Available: ${stats.available}`);
        console.log(`Used: ${stats.used}`);
        
        console.log('\n🚀 Database seeded successfully!');
        console.log('You can now start the application with: npm start');
        
    } catch (error) {
        console.error('❌ Failed to seed database:', error);
        process.exit(1);
    } finally {
        db.close();
    }
}

// Run if called directly
if (require.main === module) {
    seedDatabase();
}

module.exports = seedDatabase;
