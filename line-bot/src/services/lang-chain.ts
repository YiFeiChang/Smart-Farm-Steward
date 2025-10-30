import { promises as fs } from 'fs';
import * as path from 'path';

import { LineUser } from '@/database/mysql/line_users';
import { AzureChatOpenAI, AzureChatOpenAIFields } from '@langchain/openai';
import { createAgent, summarizationMiddleware } from 'langchain';
import { MemorySaver } from '@langchain/langgraph';
import {
    BaseCheckpointSaver, ChannelVersions, Checkpoint, CheckpointListOptions, CheckpointMetadata, CheckpointTuple, PendingWrite
} from '@langchain/langgraph-checkpoint';
import { RunnableConfig } from '@langchain/core/runnables';

const CHECKPOINT_DIR = path.join(process.cwd(), "checkpoints");

class TxtMemorySaver extends BaseCheckpointSaver {

    // 輔助方法：根據 config 取得執行緒 ID
    private _getThreadId(config: RunnableConfig): string {
        return config.configurable?.thread_id || "default_thread";
    }

    // 輔助方法：根據 config 取得檔案路徑
    private _getFilePath(config: RunnableConfig): string {
        const threadId = this._getThreadId(config);
        return path.join(CHECKPOINT_DIR, `${threadId}.json`);
    }

    /**
     * 讀取一個特定執行緒的最新檢查點。
     */
    async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
        const filePath = this._getFilePath(config);

        try {
            const content = await fs.readFile(filePath, { encoding: 'utf-8' });

            // 讀取出來的物件就是 CheckpointTuple
            const data = JSON.parse(content) as CheckpointTuple;

            // 確保版本資訊完整
            // data.versions = data.versions || { [DEFAULT_VERSION]: 1 };

            return data;

        } catch (error) {
            // 如果檔案不存在 (ENOENT)
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
                return undefined;
            }
            // 其他讀取錯誤
            console.error(`Error reading checkpoint file for thread ${this._getThreadId(config)}:`, error);
            // 為了不影響運行，可以選擇返回 undefined
            return undefined;
        }
    }

    /**
     * 列出所有或符合條件的檢查點 (由於是檔案儲存，我們只列出最新的檢查點)。
     */
    async *list(config: RunnableConfig, options?: any): AsyncGenerator<CheckpointTuple> {
        // 在一個簡單的檔案儲存器中，我們假設每個 thread_id 只有一個文件 (最新的檢查點)

        try {
            await fs.mkdir(CHECKPOINT_DIR, { recursive: true });
            const files = await fs.readdir(CHECKPOINT_DIR);

            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(CHECKPOINT_DIR, file);
                    const content = await fs.readFile(filePath, { encoding: 'utf-8' });
                    const checkpointTuple = JSON.parse(content) as CheckpointTuple;

                    // 確保版本資訊完整
                    // checkpointTuple.versions = checkpointTuple.versions || { [DEFAULT_VERSION]: 1 };

                    yield checkpointTuple; // 產生 (yield) 檢查點
                }
            }
        } catch (error) {
            // 如果目錄不存在或讀取失敗，就當作沒有檢查點
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
                return;
            }
            console.error("Error listing checkpoints:", error);
            // 遇到錯誤，結束 generator
        }
    }

    /**
     * 儲存一個新的檢查點。
     */
    async put(config: RunnableConfig, checkpoint: Checkpoint, metadata: CheckpointMetadata, newVersions: ChannelVersions): Promise<RunnableConfig> {
        // 確保檢查點目錄存在
        await fs.mkdir(CHECKPOINT_DIR, { recursive: true });

        const filePath = this._getFilePath(config);

        const dataToSave: CheckpointTuple = {
            checkpoint: checkpoint,
            config: config,
            metadata: metadata,
            // versions: newVersions, // 儲存最新的版本資訊
        };

        try {
            // 將物件序列化為美觀的 JSON 字串 (縮排 2 格)
            // const jsonString = JSON.stringify(dataToSave, null, 2);
            const jsonString = JSON.stringify(dataToSave);

            // 寫入檔案，會覆蓋舊的檢查點 (因為我們只儲存最新的)
            await fs.writeFile(filePath, jsonString, { encoding: 'utf-8' });

            // 回傳儲存成功後的 config
            return config;
        } catch (error) {
            console.error(`Error writing checkpoint file to ${filePath}:`, error);
            throw new Error(`Failed to save checkpoint: ${error}`);
        }
    }

    /**
     * 儲存執行緒中的原子性寫入。
     * * 註：在單檔儲存的簡單實作中，通常將 "writes" 視為下一版完整的 Checkpoint 儲存，
     * 故此處我們**不做任何操作**。
     * 在複雜的資料庫儲存中，這會是用於交易 (transaction) 處理。
     */
    async putWrites(config: RunnableConfig, writes: PendingWrite[], taskId: string): Promise<void> {
        // 在一個簡單的檔案儲存器中，我們不實作 putWrites 的邏輯，
        // 因為我們假設所有的狀態變更都會通過 put() 來儲存一個完整的 Checkpoint。
        // 如果需要實作，則需要複雜的鎖定機制來保證檔案操作的原子性。
        console.warn(`TxtMemorySaver.putWrites is not implemented and skipped for thread: ${this._getThreadId(config)}`);
    }

    /**
     * 刪除特定執行緒的所有檢查點紀錄。
     */
    async deleteThread(threadId: string): Promise<void> {
        const filePath = path.join(CHECKPOINT_DIR, `${threadId}.json`);

        try {
            await fs.unlink(filePath);
            console.log(`Successfully deleted checkpoint file for thread: ${threadId}`);
        } catch (error) {
            // 如果檔案不存在 (ENOENT)，我們也視為成功刪除
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
                console.log(`Checkpoint file for thread ${threadId} not found, assumed deleted.`);
                return;
            }
            // 其他刪除錯誤
            console.error(`Error deleting checkpoint file for thread ${threadId}:`, error);
            throw new Error(`Failed to delete thread checkpoint: ${error}`);
        }
    }
}

class DatabaseMemorySaver extends BaseCheckpointSaver {
    private _saver: MemorySaver = new MemorySaver();

    async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
        const r = await this._saver.getTuple(config);
        console.debug(`${JSON.stringify({ method: 'getTuple', parameters: { config }, result: r })}\n`);
        return this._saver.getTuple(config);
    }
    list(config: RunnableConfig, options?: CheckpointListOptions): AsyncGenerator<CheckpointTuple> {
        // console.debug(`${JSON.stringify({ method: 'list', parameters: { config, options } })}\n`);
        return this._saver.list(config, options);
    }
    async put(config: RunnableConfig, checkpoint: Checkpoint, metadata: CheckpointMetadata, newVersions: ChannelVersions): Promise<RunnableConfig> {
        // console.debug(`${JSON.stringify({ method: 'put', parameters: { config, checkpoint, metadata, newVersions } })}\n`);
        return this._saver.put(config, checkpoint, metadata);
    }
    async putWrites(config: RunnableConfig, writes: PendingWrite[], taskId: string): Promise<void> {
        // console.debug(`${JSON.stringify({ method: 'putWrites', parameters: { config, writes, taskId } })}\n`);
        return this._saver.putWrites(config, writes, taskId);
    }
    async deleteThread(threadId: string): Promise<void> {
        // console.debug(`${JSON.stringify({ method: 'deleteThread', parameters: { threadId } })}\n`);
        return this._saver.deleteThread(threadId);
    }
}

const
    main2Fields: AzureChatOpenAIFields = {
        model: process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME ?? 'gpt-5-nano',
        temperature: parseFloat(process.env.AZURE_OPENAI_API_TEMPERATURE ?? '1'),
        maxTokens: parseInt(process.env.AZURE_OPENAI_MAX_OUTPUT_TOKENS ?? '4000'),
        azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
        azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME,
        azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION
    };

const
    main2Model = new AzureChatOpenAI(main2Fields);
const checkpointer = new TxtMemorySaver();

export async function chat(userMessages: string, user?: LineUser) {
    const systemPrompt = `
你是一個農業與耕種知識助手，專為協助使用者管理農場、種植作物與解決農業問題而設計。
你的目標是提供準確、實用、簡短的回答。禁止長篇大論或教學式說明。
禁止使用 Markdown、符號格式化或任何排版語法。輸出必須像自然對話一樣。

以下下內容為與你對話的使用者資訊(JSON 格式)：
\`\`\`json
${JSON.stringify(user)}
\`\`\`
根據其中的 \`language\`，使用相同語言進行回覆。
可使用 \`displayName\` 或其暱稱稱呼對方，使談話自然親切。
若使用者語言為中文，回答以口語化中文表達；若為英文則使用簡潔自然的英文。

回答原則：

1. 每次回覆不超過 10 句，成熟、親切且長話短說。
2. 專注於農業、作物、土壤、氣候、病蟲害、灌溉、肥料與農場管理。專注主題以外的事一率當作不知道。(非常重要)
3. 回答時避免專業術語堆疊，盡量以農民聽得懂的話表達。

當你準備回覆時，根據使用者資訊自動調整語氣與語言，開始像人一樣自然地回答。`.trim();
    const agent = createAgent({
        systemPrompt: systemPrompt,
        model: main2Model,
        tools: [],
        middleware: [
            summarizationMiddleware({
                model: main2Model,
                maxTokensBeforeSummary: 4000,
                messagesToKeep: 10
            }),
        ],
        checkpointer: checkpointer
    });
    const config = { configurable: { thread_id: user?.userId ?? "default_thread" } };
    const finalResponse = await agent.invoke({ messages: userMessages }, config);

    return finalResponse.messages.at(-1)?.content;
}