import axios, { AxiosInstance } from 'axios';

const
    lineApiBase = 'https://api.line.me/v2/bot',
    accessToken: string = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '',
    channelSecret: string = process.env.LINE_CHANNEL_SECRET ?? '';

const lineAPI: AxiosInstance = axios.create({
    baseURL: lineApiBase,
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
    }
});

export async function replyMessage(replyToken: string, messages: any[]): Promise<void> {
    try {
        const replyData = { replyToken, messages };
        await lineAPI.post('/message/reply', replyData);
    } catch (error) {
        console.error('Error replying message:', (error as any).response ? JSON.stringify((error as any).response.data) : (error as any).message);
    }
}

export async function getUserProfile(userId: string): Promise<any | null> {
    try {
        const response = await lineAPI.get(`/profile/${userId}`);
        return response.data;
    } catch (error) {
        console.error('Error getting user profile:', (error as any).response ? JSON.stringify((error as any).response.data) : (error as any).message);
        return null;
    }
}