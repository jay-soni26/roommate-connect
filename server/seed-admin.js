const { PrismaClient } = require('./prisma/generated-client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    // 1. Super Admin
    const superEmail = 'admin@roommate.com';
    const superPassword = await bcrypt.hash('admin123', 10);
    const superAdmin = await prisma.user.upsert({
        where: { email: superEmail },
        update: { role: 'SUPER_ADMIN', password: superPassword },
        create: {
            email: superEmail,
            password: superPassword,
            name: 'Roommate-Connect Official',
            role: 'SUPER_ADMIN',
            phoneNumber: '0000000000'
        }
    });
    console.log('Super Admin created:', superAdmin.email);

    // 2. Sub Admin
    const subEmail = 'jay951054@gmail.com';
    const subPassword = await bcrypt.hash('admin123', 10); // Easy password for testing
    const subAdmin = await prisma.user.upsert({
        where: { email: subEmail },
        update: { role: 'ADMIN', password: subPassword },
        create: {
            email: subEmail,
            password: subPassword,
            name: 'Roommate-Connect Helper',
            role: 'ADMIN',
            phoneNumber: '0000000001'
        }
    });
    console.log('Sub Admin created:', subAdmin.email);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
