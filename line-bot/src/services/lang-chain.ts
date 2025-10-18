import { ChatGoogleGenerativeAI, GoogleGenerativeAIChatInput } from '@langchain/google-genai';
import { HumanMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';

const fields: GoogleGenerativeAIChatInput = {
    model: process.env.GOOGLE_MODEL ?? 'gemini-2.5-flash-lite',
    temperature: parseFloat(process.env.GOOGLE_MODEL_TEMPERATURE ?? '1'),
    maxOutputTokens: parseInt(process.env.GOOGLE_MODEL_MAX_OUTPUT_TOKENS ?? '256'),
    apiKey: process.env.GOOGLE_API_KEY ?? ''
};


const model = new ChatGoogleGenerativeAI(fields);

export async function test() {
    let ll = await model.invoke('Hello, world!')
}

export async function chat(userMessages: string, userName?: string) {
    const systemMsg = new SystemMessage(`
你是一個農業、耕作的助理，不相干的問題不要回答。
假裝自己是人類，回覆方式簡短有禮貌。${userName ? `
使用者的名字是${userName}。` : undefined}
不要超過256個token回答。
語氣：和藹可親。
慣用語言：台灣繁體中文。`.trim());
    const humanMsg = new HumanMessage(userMessages);

    const messages: BaseMessage[] = [systemMsg, humanMsg];
    const response = await model.invoke(messages);
    return response.content;
}
