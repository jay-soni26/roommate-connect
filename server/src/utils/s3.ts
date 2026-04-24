import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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

/**
 * Generates a presigned URL for an S3 object.
 * If the URL is already a full URL and NOT an S3 key, it returns it as is.
 */
export const getPresignedUrl = async (keyOrUrl: string | null | undefined): Promise<string | null> => {
    if (!keyOrUrl) return null;
    
    // If it's already a full HTTP URL, we don't need to sign it unless it's our own S3 bucket URL
    if (keyOrUrl.startsWith('http')) {
        const bucketName = process.env.AWS_S3_BUCKET_NAME;
        if (!bucketName || !keyOrUrl.includes(`${bucketName}.s3`)) {
            return keyOrUrl;
        }
        // Extract key from full S3 URL
        try {
            const url = new URL(keyOrUrl);
            keyOrUrl = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
        } catch (e) {
            return keyOrUrl;
        }
    }

    try {
        const command = new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: keyOrUrl,
        });
        // URL expires in 1 hour
        return await getSignedUrl(s3, command, { expiresIn: 3600 });
    } catch (error) {
        console.error('Error generating presigned URL:', error);
        return keyOrUrl;
    }
};

export default s3;
