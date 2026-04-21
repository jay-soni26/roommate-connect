const { PrismaClient: SqliteClient } = require('./prisma/sqlite-client');
const { PrismaClient: PostgresClient } = require('./prisma/generated-client');

const sqlite = new SqliteClient();
const postgres = new PostgresClient();

async function migrate() {
    console.log('🚀 Starting migration from SQLite to PostgreSQL...');

    try {
        // 1. Migrate Users
        console.log('👥 Migrating Users...');
        const users = await sqlite.user.findMany();
        console.log(`Found ${users.length} users in SQLite.`);
        for (const user of users) {
            await postgres.user.upsert({
                where: { email: user.email },
                update: { ...user },
                create: { ...user }
            });
        }

        // 2. Migrate Profiles
        console.log('👤 Migrating Profiles...');
        const profiles = await sqlite.profile.findMany();
        for (const profile of profiles) {
            await postgres.profile.upsert({
                where: { userId: profile.userId },
                update: { ...profile },
                create: { ...profile }
            });
        }

        // 3. Migrate Rooms
        console.log('🏠 Migrating Rooms...');
        const rooms = await sqlite.room.findMany();
        for (const room of rooms) {
            await postgres.room.upsert({
                where: { id: room.id },
                update: { ...room },
                create: { ...room }
            });
        }

        // 4. Migrate Chats
        console.log('💬 Migrating Chats...');
        const chats = await sqlite.chat.findMany();
        for (const chat of chats) {
            await postgres.chat.upsert({
                where: { id: chat.id },
                update: { ...chat },
                create: { ...chat }
            });
        }

        // 5. Migrate Messages
        console.log('📩 Migrating Messages...');
        const messages = await sqlite.message.findMany();
        for (const message of messages) {
            await postgres.message.upsert({
                where: { id: message.id },
                update: { ...message },
                create: { ...message }
            });
        }

        // 6. Migrate Favorites
        console.log('⭐ Migrating Favorites...');
        const favorites = await sqlite.favorite.findMany();
        for (const favorite of favorites) {
            await postgres.favorite.upsert({
                where: { userId_roomId: { userId: favorite.userId, roomId: favorite.roomId } },
                update: { ...favorite },
                create: { ...favorite }
            });
        }

        console.log('✅ Migration completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await sqlite.$disconnect();
        await postgres.$disconnect();
    }
}

migrate();
