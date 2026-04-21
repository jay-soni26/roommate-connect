const { PrismaClient } = require('./prisma/generated-client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.count();
  const rooms = await prisma.room.count();
  const favorites = await prisma.favorite.count();
  console.log('--- DATABASE STATUS ---');
  console.log('Total Users:', users);
  console.log('Total Rooms:', rooms);
  console.log('Total Favorites:', favorites);
  console.log('------------------------');
}
main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
