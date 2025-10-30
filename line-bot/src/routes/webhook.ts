import { Router, Request, Response } from 'express';
import { replyMessage, getUserProfile } from '@/services/line';
import { chatFromLine } from '@/services/gemini';
import { Content } from '@google/genai';
import { LineUser, lineUserProfileToLineUser, upsertUserProfile } from '@/database/mysql/line_users';
import { insertLineMessageEventLog } from '@/database/mongo/line_message_event_logs';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
    let userProfile: LineUser;
    try {
        if (!req.body || !req.body.events) {
            console.log('Invalid request body');
            return res.status(400).send('Bad Request');
        }
        for (const event of req.body.events) {
            insertLineMessageEventLog(event).catch(console.error);
            if (event.mode !== 'active' ||
                event.source.type !== 'user')
                continue;
            userProfile = lineUserProfileToLineUser(await getUserProfile(event.source.userId));
            await upsertUserProfile(userProfile);
            switch (event.type) {
                case 'message':
                    handleMessageEvent(event, userProfile).catch(console.error);
                    break;
            }
        }
        return res.status(200);
    } catch (err) {
        return res.status(500).send(err);
    }
});

async function handleMessageEvent(event: any, userProfile: LineUser) {
    const uniqueHistory: Content[] | undefined = await chatFromLine(event.message.text, userProfile);
    const messages = (uniqueHistory ?? [])
        .flatMap(content =>
            (content.parts ?? [])
                .filter((part): part is { text: string } => 'text' in part && typeof part.text === 'string')
                .map(part => ({
                    type: 'text',
                    text: part.text
                }))
        );
    await replyMessage(event.replyToken, messages);
}

export default router;