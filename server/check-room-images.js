const { PrismaClient } = require('./prisma/generated-client');
const p = new PrismaClient();
async function main() {
    const r = await p.room.findFirst({where: {images: {not: null}}});
    console.log(r ? r.images : 'no rooms with images');
}
main().finally(() => p.$disconnect());
