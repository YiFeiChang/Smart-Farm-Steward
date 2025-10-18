import { PoolConnection } from 'mysql2/promise';
import userPool from '.';

export const createLineUsersTableSql = `
CREATE TABLE IF NOT EXISTS line_users (
    user_id VARCHAR(50) NOT NULL PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL,
    picture_url TEXT,
    status_message TEXT,
    language VARCHAR(10),
    created_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);`.trim();

export interface LineUser {
    userId: string;
    displayName: string;
    pictureUrl?: string | null;
    statusMessage?: string | null;
    language?: string | null;
    createdTime?: Date;
    updatedTime?: Date;
}

export function lineUserProfileToLineUser(lineUserProfile: any): LineUser {
    return {
        userId: lineUserProfile.userId,
        displayName: lineUserProfile.displayName,
        pictureUrl: lineUserProfile.pictureUrl,
        statusMessage: lineUserProfile.statusMessage,
        language: lineUserProfile.language
    };
}

export async function upsertUserProfile(userProfile: LineUser) {
    console.log(`[${new Date().toISOString()}] [INFO] [upsertUserProfile] - Function start | userId=${userProfile.userId}`);

    const sqlStatement = `
INSERT INTO line_users (user_id, display_name, picture_url, status_message, language)
VALUES (?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
    display_name = VALUES(display_name),
    picture_url = VALUES(picture_url),
    status_message = VALUES(status_message),
    language = VALUES(language),
    updated_time = CURRENT_TIMESTAMP;`.trim();

    console.log(`[${new Date().toISOString()}] [DEBUG] [upsertUserProfile] - SQL statement prepared`);

    const values: any = [
        userProfile.userId,
        userProfile.displayName,
        userProfile.pictureUrl,
        userProfile.statusMessage,
        userProfile.language
    ];

    console.log(`[${new Date().toISOString()}] [DEBUG] [upsertUserProfile] - Values bound | userId=${userProfile.userId}`);

    const connection: PoolConnection = await userPool.getConnection();
    console.log(`[${new Date().toISOString()}] [INFO] [upsertUserProfile] - DB connection acquired | userId=${userProfile.userId}`);

    await connection.beginTransaction();
    console.log(`[${new Date().toISOString()}] [INFO] [upsertUserProfile] - Transaction started | userId=${userProfile.userId}`);

    try {
        console.log(`[${new Date().toISOString()}] [INFO] [upsertUserProfile] - Executing SQL | userId=${userProfile.userId}`);

        const [result] = await connection.query(sqlStatement, values);
        console.log(`[${new Date().toISOString()}] [INFO] [upsertUserProfile] - Query executed successfully | userId=${userProfile.userId}`);

        await connection.commit();
        console.log(`[${new Date().toISOString()}] [INFO] [upsertUserProfile] - Transaction committed | userId=${userProfile.userId}`);

        return result;
    } catch (err) {
        await connection.rollback();
        console.log(
            `[${new Date().toISOString()}] [ERROR] [upsertUserProfile] - Transaction rolled back | userId=${userProfile.userId} | error=${(err as Error).message}`
        );
        throw err;
    } finally {
        await connection.release();
        console.log(`[${new Date().toISOString()}] [INFO] [upsertUserProfile] - Connection released | userId=${userProfile.userId}`);
    }
}