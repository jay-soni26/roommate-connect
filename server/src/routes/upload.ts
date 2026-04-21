import { Router } from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth';
import { s3Upload } from '../utils/s3';

const router = Router();


router.post('/room-images', authenticateToken, (req: any, res: any, next: any) => {
    s3Upload.array('images', 5)(req, res, (err: any) => {
        if (err instanceof multer.MulterError) {
            console.error('Multer error:', err);
            return res.status(400).json({ error: `Upload error: ${err.message}` });
        } else if (err) {
            console.error('Unknown upload error:', err);
            return res.status(400).json({ error: err.message });
        }
        next();
    });
}, (req: any, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const filePaths = (req.files as any[]).map(file => file.location);
        res.json({ message: 'Images uploaded successfully', urls: filePaths });
    } catch (error: any) {
        console.error('Upload success handler error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/profile-image', authenticateToken, (req: any, res: any, next: any) => {
    s3Upload.single('avatar')(req, res, (err: any) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ error: `Upload error: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
}, (req: any, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = (req.file as any).location;
        res.json({ message: 'Avatar uploaded successfully', url: filePath });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/chat-image', authenticateToken, (req: any, res: any, next: any) => {
    s3Upload.single('image')(req, res, (err: any) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ error: `Upload error: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
}, (req: any, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = (req.file as any).location;
        res.json({ message: 'Image uploaded successfully', url: filePath });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
