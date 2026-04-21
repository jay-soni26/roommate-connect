const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('./prisma/generated-client');
require('dotenv').config();

const prisma = new PrismaClient();

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const uploadDir = path.join(__dirname, 'uploads');
const bucketName = process.env.AWS_S3_BUCKET_NAME;
const region = process.env.AWS_REGION;

async function uploadToS3(filePath, key) {
    const fileContent = fs.readFileSync(filePath);
    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: fileContent,
        ContentType: getContentType(filePath),
    });
    await s3.send(command);
    return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
}

function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.png') return 'image/png';
    if (ext === '.webp') return 'image/webp';
    if (ext === '.gif') return 'image/gif';
    return 'application/octet-stream';
}

async function migrate() {
    console.log('🚀 Starting image migration to S3...');

    if (!fs.existsSync(uploadDir)) {
        console.log('❌ uploads directory not found.');
        return;
    }

    const files = fs.readdirSync(uploadDir);
    console.log(`Found ${files.length} files in uploads folder.`);

    const migrationMap = {}; // oldPath -> newUrl

    for (const file of files) {
        const filePath = path.join(uploadDir, file);
        if (fs.lstatSync(filePath).isDirectory()) continue;

        const key = `migrated/${file}`;
        try {
            console.log(`Uploading ${file}...`);
            const s3Url = await uploadToS3(filePath, key);
            migrationMap[`/uploads/${file}`] = s3Url;
        } catch (err) {
            console.error(`Failed to upload ${file}:`, err.message);
        }
    }

    console.log('📝 Updating database paths...');

    // 1. Update Profile Avatars
    const profiles = await prisma.profile.findMany({
        where: { avatar: { contains: '/uploads/' } }
    });
    for (const profile of profiles) {
        if (migrationMap[profile.avatar]) {
            await prisma.profile.update({
                where: { id: profile.id },
                data: { avatar: migrationMap[profile.avatar] }
            });
        }
    }
    console.log(`Updated ${profiles.length} profiles.`);

    // 2. Update Room Images
    const rooms = await prisma.room.findMany({
        where: { images: { contains: '/uploads/' } }
    });
    for (const room of rooms) {
        try {
            let imagePaths = JSON.parse(room.images);
            if (Array.isArray(imagePaths)) {
                const newPaths = imagePaths.map(p => migrationMap[p] || p);
                await prisma.room.update({
                    where: { id: room.id },
                    data: { images: JSON.stringify(newPaths) }
                });
            }
        } catch (e) {
            console.error(`Failed to parse images for room ${room.id}`);
        }
    }
    console.log(`Updated ${rooms.length} rooms.`);

    // 3. Update Message images
    const messages = await prisma.message.findMany({
        where: { imageUrl: { contains: '/uploads/' } }
    });
    for (const message of messages) {
        if (migrationMap[message.imageUrl]) {
            await prisma.message.update({
                where: { id: message.id },
                data: { imageUrl: migrationMap[message.imageUrl] }
            });
        }
    }
    console.log(`Updated ${messages.length} messages.`);

    console.log('✅ Migration finished!');
}

migrate()
    .catch(err => console.error(err))
    .finally(() => prisma.$disconnect());
