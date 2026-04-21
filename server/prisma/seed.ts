import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Starting Database Seeding ---');
    const hashedPassword = await bcrypt.hash('123456', 10);
    
    // 60 Sample Names for Users
    const names = [
        'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Ishaan', 'Aaryan', 'Shaurya', 'Atharv',
        'Ananya', 'Diya', 'Pari', 'Anika', 'Ira', 'Sana', 'Aavya', 'Avni', 'Myra', 'Kyra',
        'Rohan', 'Karan', 'Vikram', 'Siddharth', 'Amit', 'Sanjay', 'Rahul', 'Priya', 'Sneha', 'Neha',
        'Abhishek', 'Riya', 'Sameer', 'Pooja', 'Deepak', 'Jyoti', 'Manish', 'Kiran', 'Aakash', 'Megha',
        'Sunil', 'Anita', 'Rajesh', 'Preeti', 'Manoj', 'Kavita', 'Suresh', 'Shweta', 'Vijay', 'Tina',
        'Harish', 'Monica', 'Santosh', 'Divya', 'Rakesh', 'Pragati', 'Vinay', 'Nisha', 'Tushar', 'Aarti'
    ];

    console.log('Cleaning existing data...');
    // Delete in correct order to avoid foreign key constraints
    await prisma.notification.deleteMany();
    await prisma.message.deleteMany();
    await prisma.chat.deleteMany();
    await prisma.room.deleteMany();
    await prisma.profile.deleteMany();
    // Keep Super Admin if exists, otherwise delete all
    const superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
    if (superAdmin) {
        await prisma.user.deleteMany({ where: { NOT: { id: superAdmin.id } } });
        console.log('Preserving Super Admin account.');
    } else {
        await prisma.user.deleteMany();
        // Create a default Super Admin for the user to use
        await prisma.user.create({
            data: {
                email: 'admin@gmail.com',
                name: 'Super Admin',
                password: hashedPassword,
                role: 'SUPER_ADMIN',
                profile: { create: { bio: 'System Administrator', gender: 'Male' } }
            }
        });
        console.log('Created default Super Admin: admin@gmail.com / 123456');
    }

    const cities = ['Pune', 'Mumbai'];
    const areas: { [key: string]: string[] } = {
        'Pune': ['Hinjewadi', 'Baner', 'Kothrud', 'Viman Nagar', 'Magarpatta', 'Wakad', 'Kharadi', 'Pimple Saudagar', 'Aundh', 'Pashan'],
        'Mumbai': ['Andheri', 'Bandra', 'Dadar', 'Borivali', 'Powai', 'Colaba', 'Worli', 'Juhu', 'Malad', 'Kandivali']
    };
    const propertyTypes = ['1BHK', '2BHK', '1RK', '3BHK', 'Row House'];
    const pTypes = ['OFFERING', 'SEEKING'];
    const genders = ['Male', 'Female', 'Any'];
    const furnishings = ['FURNISHED', 'SEMI_FURNISHED', 'UNFURNISHED'];
    
    const roomImages = [
        "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&q=80&w=800",
        "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80&w=800",
        "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&q=80&w=800",
        "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&q=80&w=800",
        "https://images.unsplash.com/photo-1527359443443-84a18acc7321?auto=format&fit=crop&q=80&w=800",
        "https://images.unsplash.com/photo-1554995207-c18c20360a59?auto=format&fit=crop&q=80&w=800",
        "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&q=80&w=800",
        "https://images.unsplash.com/photo-1536376074432-8cb375e53805?auto=format&fit=crop&q=80&w=800",
        "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&q=80&w=800",
        "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?auto=format&fit=crop&q=80&w=800",
    ];

    console.log(`Creating 60 users with postings...`);
    
    for (let i = 0; i < names.length; i++) {
        const name = names[i];
        const email = `${name.toLowerCase()}${i}@gmail.com`;
        const userGender = i < 10 || (i >= 20 && i < 30) || (i >= 40 && i < 50) ? 'Male' : 'Female';

        const user = await prisma.user.create({
            data: {
                email,
                name,
                password: hashedPassword,
                role: 'USER',
                profile: {
                    create: {
                        bio: `Hi, I'm ${name}. I'm looking for a comfortable living space and friendly roommates in the city.`,
                        gender: userGender,
                        occupation: i % 3 === 0 ? 'Software Engineer' : (i % 3 === 1 ? 'Student' : 'Professional'),
                        city: i % 2 === 0 ? 'Pune' : 'Mumbai',
                        state: 'Maharashtra'
                    }
                }
            }
        });

        // Create 1-3 postings for each user
        const postCount = Math.floor(Math.random() * 3) + 1;
        
        for (let j = 0; j < postCount; j++) {
            const city = cities[Math.floor(Math.random() * cities.length)];
            const cityAreas = areas[city];
            const area = cityAreas[Math.floor(Math.random() * cityAreas.length)];
            const postingType = pTypes[Math.floor(Math.random() * pTypes.length)];
            const propType = propertyTypes[Math.floor(Math.random() * propertyTypes.length)];
            
            // Random images for OFFERING
            let selectedImages = null;
            if (postingType === 'OFFERING') {
                const shuffled = [...roomImages].sort(() => 0.5 - Math.random());
                selectedImages = JSON.stringify(shuffled.slice(0, Math.floor(Math.random() * 3) + 1));
            }

            await prisma.room.create({
                data: {
                    ownerId: user.id,
                    postingType,
                    title: postingType === 'OFFERING' 
                        ? `${propType} available in ${area}, ${city}` 
                        : `Looking for room/roommate in ${area}, ${city}`,
                    description: `Clean and spacious ${propType}. Looking for someone ${postingType === 'OFFERING' ? 'to join us' : 'who can host'}. The area is ${area}, which is very convenient for travel and basic needs.`,
                    location: area,
                    city,
                    state: 'Maharashtra',
                    address: `${area} Towers, near Local Station`,
                    rentPerPerson: Math.floor(Math.random() * 12000) + 4000,
                    capacity: Math.floor(Math.random() * 3) + 1,
                    currentOccupancy: postingType === 'OFFERING' ? Math.floor(Math.random() * 2) : 0,
                    propertyType: propType,
                    furnishing: furnishings[Math.floor(Math.random() * furnishings.length)],
                    genderPreference: postingType === 'OFFERING' ? genders[Math.floor(Math.random() * genders.length)] : userGender,
                    images: selectedImages,
                }
            });
        }
    }

    console.log('--- Seeding Completed Successfully ---');
    console.log(`Summary: Created 60 Users and approximately ${Math.floor(names.length * 2)} Postings.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
