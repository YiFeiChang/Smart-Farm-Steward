import { Router, Request, Response } from 'express';
import { replyMessage, getUserProfile } from '@/services/line';
import { chat } from '@/services/lang-chain';

const router = Router();

router.post('/', (req: Request, res: Response) => {
    if (!req.body || !req.body.events) {
        console.log('Invalid request body');
        return res.status(400).send('Bad Request');
    }
    for (const event of req.body.events) {
        handleEvent(event);
    }
    res.sendStatus(200);
});

async function handleEvent(event: any) {
    console.log('Handling event:', event);

    if (event.type !== 'message' || event.message.type !== 'text') {
        const messages = [{
            type: 'sticker',
            packageId: '11537',
            stickerId: '52002770'
        }, {
            type: 'text',
            text: '對不起，我目前只能理解文字訊息喔～'
        }];
        await replyMessage(event.replyToken, messages);
        return;
    }

    const userProfile = await getUserProfile(event.source.userId);
    console.log('User Profile:', userProfile);

    // Example: Reply with user's display name
    const replyText = userProfile
        ? await chat(event.message.text, userProfile.displayName)
        : await chat(event.message.text);

    const messages = [{
        type: 'text',
        text: replyText
    }];

    await replyMessage(event.replyToken, messages);
}

export default router;