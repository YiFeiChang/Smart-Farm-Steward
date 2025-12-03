import {
    GoogleGenAI, GoogleGenAIOptions, Content, GenerateContentResponse, Chat, Type,
    CreateChatParameters, GenerateContentConfig, GenerateContentParameters, FunctionResponse,
    FunctionDeclaration
} from '@google/genai';
import {
    LineUser
} from '@/database/mysql/line_users';
import {
    WeatherStation, selectWeatherStationById
} from '@/database/mysql/weather_stations';
import {
    upsertChatHistory, selectChatHistoryByUserId, ChatHistory
} from '@/database/mysql/chat_history';
import axios from 'axios';

const
    weatherFunctionDeclaration: FunctionDeclaration = {
        name: 'get_weather',
        description: '取得氣象站資訊。',
        parameters: {
            type: Type.OBJECT,
            properties: {
                stationName: {
                    type: Type.STRING,
                    description: '氣象站名稱，例如「臺南」、「永康」。',
                }
            },
            required: ['stationName']
        },
    },
    timeFunctionDeclaration: FunctionDeclaration = {
        name: 'get_current_utc_time',
        description: '取得當前的 UTC（世界協調時間）。',
        parameters: {
            type: Type.OBJECT,
            properties: {
            },
            required: [
            ]
        }
    };

const
    maxTokensBeforeSummary: number = parseInt(process.env.GOOGLE_MODEL_MAXTOKENSBEFORESUMMARY ?? '4000'),
    cwaApiKey: string = process.env.CWA_API_KEY ?? '',
    summaryKeepRounds: number = parseInt(process.env.GOOGLE_MODEL_SUMMARYKEEPROUNDS ?? '20'),
    options: GoogleGenAIOptions = {
        apiKey: process.env.GOOGLE_API_KEY
    },
    ai: GoogleGenAI = new GoogleGenAI(options),
    chatConfig: GenerateContentConfig = {
        temperature: parseFloat(process.env.GOOGLE_MODEL_TEMPERATURE ?? '0.7'),
        maxOutputTokens: parseInt(process.env.GOOGLE_MODEL_MAX_OUTPUT_TOKENS ?? '1024'),
        tools: [
            {
                functionDeclarations: [
                    weatherFunctionDeclaration,
                    timeFunctionDeclaration
                ]
            }
        ],
        systemInstruction: `
# 角色與性格

你是專門回答農業及農作物問題的 AI 助理。你的性格和藹可親，像一位經驗豐富的農場前輩。你可以參考下方使用者資訊中的 \`displayName\`，為使用者創造一個親切的暱稱。例如，如果 \`displayName\` 是「阿明」，你可以稱呼他「阿明小農友」或「阿明夥伴」。如果 \`displayName\` 不適合取名，你也可以使用「小農友」或「小夥伴」等通用稱呼。

# 核心規則

1.  **專注領域**：你的所有回答都必須與農業、農作物、園藝相關。嚴格禁止回答任何無關的話題。
2.  **語言一致**：你必須全程使用與使用者相同的語言進行對話。

# 輸出格式

1.  **LINE 聊天格式**：你的回覆是為了顯示在 LINE 聊天室中，因此嚴格**禁止使用 Markdown 或其他的格式化輸出**。
2.  **簡潔扼要**：回覆必須簡短有力，切中要點，禁止任何長篇大論。

# 特殊指令：時間處理流程

當使用者詢問時間時，你必須嚴格遵循以下順序處理：

1.  **取得 UTC 時間**：首先，透過工具取得當前的 UTC 標準時間。
2.  **推斷使用者時區**：
    a. **優先**：根據下方使用者資訊中的 \`language\` 欄位進行推斷（例如 \`zh-TW\` 代表台北，\`ja-JP\` 代表東京）。
    b. **其次**：若語言無法判斷，則分析對話歷史，尋找城市或地區的線索。
3.  **主動詢問**：如果以上步驟都無法讓你百分之百確定使用者的時區，你**必須**主動詢問：「為了給您準確的當地時間，請問您現在在哪個城市呢？」
4.  **回覆當地時間**：在確認時區後，將 UTC 時間轉換為該地的當地時間再進行回覆。

**最終禁令：在任何情況下，都禁止直接使用 UTC 時間回覆使用者。**

---
以下是你正在對話的使用者資訊 (JSON 格式)：
\`\`\`json
{userInfo}
\`\`\``.trim()
    },
    summaryConfig: GenerateContentConfig = {
        temperature: 0,
        maxOutputTokens: parseInt(process.env.GOOGLE_MODEL_SUMMARY_MAX_OUTPUT_TOKENS ?? '1024'),
        systemInstruction: `
你是一個專業的對話歷史紀錄分析員。你的任務是將一組冗長的對話內容，濃縮成一個資訊完整的摘要。

請務必遵守以下規則：
1. **目標：** 摘要的目的是為了在後續的對話中，取代舊的對話歷史，作為新的背景知識。
2. **內容優先級：** 必須包含『用戶的最終目的』、『已確認的細節或偏好』、『關鍵人名或地點』、『重要的決策點』，注意相同內容勿重複紀錄。
3. **格式：** 採用精煉的條列式或簡短段落，以最大化資訊密度，嚴格控制在被分配的 maxOutputTokens 限制內。
4. **開頭標記：** 摘要內容必須以明確的標籤『【SUMMARY】』開頭，以便後續模型識別這是背景而非新的提問。
5. **語言：** 摘要內容必須使用與使用者相同的語言。`.trim()
    },
    chatParameters: CreateChatParameters = {
        model: process.env.GOOGLE_MODEL ?? 'gemini-2.5-flash',
        config: chatConfig,
        history: []
    },
    summaryParameters: GenerateContentParameters = {
        model: process.env.GOOGLE_MODEL ?? 'gemini-2.5-flash',
        config: summaryConfig,
        contents: []
    };

let history: Content[] | undefined = [];

export async function chatFromLine(message: string, userInfo: LineUser): Promise<Content[] | undefined> {
    let result: Content[] | undefined = undefined;
    const now: Date = new Date();
    chatConfig.systemInstruction = (chatConfig.systemInstruction as string).replace('{userInfo}', JSON.stringify(userInfo));
    let chatHistory: ChatHistory | undefined = await selectChatHistoryByUserId(userInfo.userId);
    if (chatHistory)
        chatParameters.history = chatHistory.history ?? [];
    else {
        chatHistory = {
            lineUserId: userInfo.userId,
            history: []
        };
        chatParameters.history = [];
    }
    const
        chat: Chat = await ai.chats.create(chatParameters);
    let response: GenerateContentResponse = await chat.sendMessage({ message: message }),
        totalTokenCount: number = response.usageMetadata?.totalTokenCount ?? 0;
    if (response.functionCalls && response.functionCalls.length > 0) {
        for (const call of response.functionCalls) {
            let functionResponse: FunctionResponse;
            switch (call.name) {
                default:
                    continue;
                case 'get_weather':
                    const stationName = call.args?.stationName as string;
                    const weatherResponse = await axios.get('https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0003-001', {
                        params: {
                            Authorization: cwaApiKey,
                            StationName: stationName
                        }
                    });
                    functionResponse = {
                        name: 'get_weather',
                        response: {}
                    };
                    if (weatherResponse.data?.records?.Station?.length > 0) {
                        const stationData = weatherResponse.data.records.Station[0];
                        functionResponse.response = {
                            result: {
                                stationName: stationData.StationName,
                                countyName: stationData.GeoInfo.CountyName,
                                townName: stationData.GeoInfo.TownName,
                                observationTime: stationData.ObsTime.DateTime,
                                weather: stationData.WeatherElement.Weather,
                                temperature: parseFloat(stationData.WeatherElement.AirTemperature),
                                humidity: parseFloat(stationData.WeatherElement.RelativeHumidity) / 100, // Convert to 0-1 range
                                windSpeed: parseFloat(stationData.WeatherElement.WindSpeed),
                                precipitation: parseFloat(stationData.WeatherElement.Now.Precipitation),
                                uvIndex: parseInt(stationData.WeatherElement.UVIndex, 10)
                            }
                        };
                    } else {
                        functionResponse.response = {
                            error: `找不到氣象站「${stationName}」的即時天氣資訊。`,
                            suggestion: '請確認氣象站名稱是否正確，或嘗試其他鄰近的氣象站名稱，例如：「臺南」、「善化」。'
                        };
                    }
                    break;
                case 'get_current_utc_time':
                    functionResponse = {
                        name: 'get_current_utc_time',
                        response: {
                            result: `現在的 UTC 時間是 ${now.toISOString()}，回覆給使用者時直接轉換成他的地區時間。`
                        }
                    }
                    break;
            }
            response = await chat.sendMessage({ message: [{ functionResponse: functionResponse }] });
            totalTokenCount = response.usageMetadata?.totalTokenCount ?? 0;
        }
    }
    result = getUniqueHistory(chat.getHistory(), chatHistory.history)
        .filter(content => content.role === 'model' && content.parts && content.parts.length > 0);
    chatHistory.history = chat.getHistory();
    if (totalTokenCount > maxTokensBeforeSummary) {
        const { keepRounds, summaryRounds } = splitConversationByRounds(chatHistory.history, summaryKeepRounds);
        if (summaryRounds.length > 0) {
            const summaryContent: Content | undefined = await summary(summaryRounds);
            if (summaryContent)
                chatHistory.history = [summaryContent, ...keepRounds];
        }
    }
    await upsertChatHistory(chatHistory);
    return result;
}

function splitConversationByRounds(
    conversation: Content[],
    keepRounds: number
): {
    keepRounds: Content[];
    summaryRounds: Content[];
} {
    const modelIndices: number[] = [];
    conversation.forEach((content, index) => {
        if (content.role === 'model') {
            modelIndices.push(index);
        }
    });
    if (modelIndices.length === 0 || conversation.length === 0) {
        return {
            keepRounds: conversation,
            summaryRounds: [],
        };
    }
    const totalRounds = modelIndices.length;
    const actualKeepRounds = Math.min(keepRounds, totalRounds);
    let startIndexForKeep: number;
    if (actualKeepRounds === 0) {
        startIndexForKeep = conversation.length;
    } else {
        const firstKeepModelIndexInModelIndices = totalRounds - actualKeepRounds;
        const firstKeepModelIndex = modelIndices[firstKeepModelIndexInModelIndices];
        let i = firstKeepModelIndex;
        while (i > 0 && conversation[i].role !== 'user') {
            i--;
        }
        startIndexForKeep = i;
    }
    const keepRoundsArray = conversation.slice(startIndexForKeep);
    const summaryRoundsArray = conversation.slice(0, startIndexForKeep);
    return {
        keepRounds: keepRoundsArray,
        summaryRounds: summaryRoundsArray,
    };
}

async function summary(summaryRounds: Content[]): Promise<Content | undefined> {
    let result: Content | undefined = undefined;
    summaryParameters.contents = [
        ...summaryRounds,
        { role: 'user', parts: [{ text: '將以上對話，包含先前的 SUMMARY，進行總結。' }] }
    ];
    const summaryResponse: GenerateContentResponse = await ai.models.generateContent(summaryParameters);
    result = summaryResponse.candidates?.at(0)?.content;
    return result;
}

function getUniqueHistory(newHistory: Content[], oldHistory?: Content[]): Content[] {
    if (!oldHistory || oldHistory.length === 0) {
        return newHistory;
    }
    const oldHistoryStringSet = new Set(
        oldHistory.map(content => JSON.stringify(content))
    );
    const result = newHistory.filter(content => {
        const stringifiedContent = JSON.stringify(content);
        return !oldHistoryStringSet.has(stringifiedContent);
    });
    return result;
}