import { S3Client } from '@aws-sdk/client-s3';
import multer from 'multer';
import multerS3 from 'multer-s3';
import path from 'path';

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

export const s3Upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.AWS_S3_BUCKET_NAME || '',
        acl: 'public-read',
        metadata: (req: any, file: any, cb: any) => {
            cb(null, { fieldName: file.fieldname });
        },
        key: (req: any, file: any, cb: any) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const folder = req.path.includes('profile') ? 'profiles' : req.path.includes('room') ? 'rooms' : 'chats';
            cb(null, `${folder}/${uniqueSuffix}${path.extname(file.originalname)}`);
        }
    }),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

export default s3;
