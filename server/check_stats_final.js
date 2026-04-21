const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const users = await prisma.user.count();
        const rooms = await prisma.room.count();
        const chats = await prisma.chat.count();
        console.log(`CURRENT DB STATS: Users=${users}, Rooms=${rooms}, Chats=${chats}`);
    } catch (e) {
        console.error('DB CHECK ERROR:', e);
    } finally {
        await prisma.$disconnect();
    }
}

check();
