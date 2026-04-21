import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
    const userDates = await prisma.user.aggregate({ _min: { createdAt: true }, _max: { createdAt: true } });
    const roomDates = await prisma.room.aggregate({ _min: { createdAt: true }, _max: { createdAt: true } });
    const chatDates = await prisma.chat.aggregate({ _min: { createdAt: true }, _max: { createdAt: true } });
    const msgDates = await prisma.message.aggregate({ _min: { createdAt: true }, _max: { createdAt: true } });

    console.log({
        users: userDates,
        rooms: roomDates,
        chats: chatDates,
        messages: msgDates
    });

    await prisma.$disconnect();
}

check();
