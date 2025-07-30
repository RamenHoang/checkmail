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

const sampleAdminUsers = [
    { username: 'admin', password: 'admin123' },
];

async function seedDatabase() {
    console.log('🌱 Seeding Email Checker Database...');
    
    const db = new Database();
    
    try {
        await db.init();
        
        console.log('\n👤 Seeding Admin Users...');
        let adminAddedCount = 0;
        let adminSkippedCount = 0;
        
        for (const adminUser of sampleAdminUsers) {
            try {
                await db.addAdminUser(adminUser.username, adminUser.password);
                adminAddedCount++;
                console.log(`✅ Added admin: ${adminUser.username}`);
            } catch (error) {
                if (error.code === 'SQLITE_CONSTRAINT') {
                    adminSkippedCount++;
                    console.log(`⏭️  Skipped admin (exists): ${adminUser.username}`);
                } else {
                    console.error(`❌ Error adding admin ${adminUser.username}:`, error.message);
                }
            }
        }
        
        console.log('\n📧 Seeding Emails...');
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
        console.log(`👤 Admin Users - Added: ${adminAddedCount}, Skipped: ${adminSkippedCount}`);
        console.log(`📧 Emails - Added: ${addedCount}, Skipped: ${skippedCount}`);
        console.log(`� Total processed: ${sampleAdminUsers.length} admins, ${sampleEmails.length} emails`);
        
        // Show current stats
        const stats = await db.getStats();
        console.log('\n📈 Current Database Stats:');
        console.log(`Total emails: ${stats.total}`);
        console.log(`Available: ${stats.available}`);
        console.log(`Used: ${stats.used}`);
        
        console.log('\n🚀 Database seeded successfully!');
        
        if (adminAddedCount > 0) {
            console.log('\n🔐 Seeded Admin Credentials:');
            for (const adminUser of sampleAdminUsers) {
                console.log(`   Username: ${adminUser.username} | Password: ${adminUser.password}`);
            }
            console.log('\n⚠️  SECURITY NOTE: Change these passwords in production!');
        }
        
        console.log('\nYou can now start the application with: npm start');
        
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
