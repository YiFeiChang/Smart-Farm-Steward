import { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { Content } from '@google/genai';
import userPool from '.';

export const createChatSummariesTableSql = `
CREATE TABLE IF NOT EXISTS chat_histories (
    line_user_id VARCHAR(50) NOT NULL PRIMARY KEY,
    history TEXT,
    created_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (line_user_id) REFERENCES line_users(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);`.trim();

export interface ChatHistory {
    lineUserId: string;
    history?: Content[];
    createdTime?: Date;
    updatedTime?: Date;
}

export async function upsertChatHistory(chatHistory: ChatHistory): Promise<void> {
    console.log(`[${new Date().toISOString()}] [INFO] [upsertChatHistory] - function start | userId=${chatHistory.lineUserId}`);
    const sqlStatement = `
INSERT INTO chat_histories (line_user_id, history, created_time, updated_time)
VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE
    history = VALUES(history),
    updated_time = CURRENT_TIMESTAMP;`.trim();
    const values: any = [
        chatHistory.lineUserId,
        JSON.stringify(chatHistory.history)
    ];
    const connection: PoolConnection = await userPool.getConnection();
    console.log(`[${new Date().toISOString()}] [DEBUG] [upsertChatHistory] - acquired DB connection`);
    await connection.beginTransaction();
    console.log(`[${new Date().toISOString()}] [DEBUG] [upsertChatHistory] - transaction started`);
    try {
        console.log(`[${new Date().toISOString()}] [INFO] [upsertChatHistory] - executing query`);
        await connection.query(sqlStatement, values);
        await connection.commit();
        console.log(`[${new Date().toISOString()}] [INFO] [upsertChatHistory] - transaction committed`);
    } catch (error) {
        await connection.rollback();
        console.log(`[${new Date().toISOString()}] [ERROR] [upsertChatHistory] - error occurred, transaction rolled back | message=${(error as Error).message}`);
        throw error;
    } finally {
        await connection.release();
        console.log(`[${new Date().toISOString()}] [DEBUG] [upsertChatHistory] - connection released`);
    }
}

export async function selectChatHistoryByUserId(userId: string): Promise<ChatHistory | undefined> {
    let result: ChatHistory | undefined = undefined;
    const sqlStatement = `
SELECT * FROM chat_histories WHERE line_user_id = ?;`.trim();
    const values: any = [
        userId
    ];
    const connection: PoolConnection = await userPool.getConnection();
    await connection.beginTransaction();
    try {
        const queryResult: RowDataPacket[] = (await connection.query(sqlStatement, values)).at(0) as RowDataPacket[];
        if (queryResult.length > 0) {
            result = {
                lineUserId: queryResult[0].line_user_id,
                history: JSON.parse(queryResult[0].history) as Content[],
                createdTime: queryResult[0].created_time,
                updatedTime: queryResult[0].updated_time
            };
        }
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        await connection.release();
    }
    return result;
}