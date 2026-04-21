import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
    const userCount = await prisma.user.count();
    const roomCount = await prisma.room.count();
    const chatCount = await prisma.chat.count();
    const messageCount = await prisma.message.count();

    console.log({
        users: userCount,
        rooms: roomCount,
        chats: chatCount,
        messages: messageCount
    });

    await prisma.$disconnect();
}

check();
