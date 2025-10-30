import { Router, Request, Response, NextFunction } from 'express';
import { chatTest } from '@/services/gemini';

const
    router: Router = Router();

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    const conversationHistory = await chatTest(req.body.content);
    res.send(JSON.stringify(conversationHistory));
});

export default router;