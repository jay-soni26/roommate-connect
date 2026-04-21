import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
    const users = await prisma.user.findMany({
        select: { id: true, email: true, name: true }
    });
    const chats = await prisma.chat.findMany({
        include: { participants: true, messages: true }
    });

    console.log('Users:', JSON.stringify(users, null, 2));
    console.log('Chats:', JSON.stringify(chats, null, 2));

    await prisma.$disconnect();
}

check();
