import { PoolConnection } from 'mysql2/promise';
import userPool from '.';

export const createChatSummariesTableSql = `
CREATE TABLE IF NOT EXISTS chat_summaries (
    summary_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    nickname VARCHAR(100),
    summary TEXT,
    token_limit INT DEFAULT 1000,
    created_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES line_users(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);`.trim();

export interface ChatSummary {
    summaryId?: number;
    userId: string;
    nickname?: string;
    summary?: string;
    tokenLimit?: number;
    createdTime?: Date;
    updatedTime?: Date;
}

export async function upsertChatSummary(chatSummary: ChatSummary) {
    console.log(`[${new Date().toISOString()}] [INFO] [upsertChatSummary] - function start | userId=${chatSummary.userId}`);
    const sqlStatement = `
INSERT INTO chat_summaries (user_id, nickname, summary, token_limit, created_time, updated_time)
VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE
    nickname = VALUES(nickname),
    summary = VALUES(summary),
    token_limit = VALUES(token_limit),
    updated_time = CURRENT_TIMESTAMP;`.trim();
    const values: any = [
        chatSummary.userId,
        chatSummary.nickname,
        chatSummary.summary,
        chatSummary.tokenLimit
    ];
    const connection: PoolConnection = await userPool.getConnection();
    console.log(`[${new Date().toISOString()}] [DEBUG] [upsertChatSummary] - acquired DB connection`);
    await connection.beginTransaction();
    console.log(`[${new Date().toISOString()}] [DEBUG] [upsertChatSummary] - transaction started`);
    try {
        console.log(`[${new Date().toISOString()}] [INFO] [upsertChatSummary] - executing query`);
        const [result] = await connection.query(sqlStatement, values);
        await connection.commit();
        console.log(`[${new Date().toISOString()}] [INFO] [upsertChatSummary] - transaction committed`);
        console.log(`[${new Date().toISOString()}] [DEBUG] [upsertChatSummary] - returning result`);
        return result;
    } catch (err) {
        await connection.rollback();
        console.log(`[${new Date().toISOString()}] [ERROR] [upsertChatSummary] - error occurred, transaction rolled back | message=${(err as Error).message}`);
        throw err;
    } finally {
        await connection.release();
        console.log(`[${new Date().toISOString()}] [DEBUG] [upsertChatSummary] - connection released`);
    }
}