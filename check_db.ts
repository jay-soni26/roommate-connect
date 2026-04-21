import prisma from './server/src/utils/prisma';

async function check() {
    const users = await prisma.user.count();
    const rooms = await prisma.room.count();
    console.log(`Users: ${users}, Rooms: ${rooms}`);
}

check();
