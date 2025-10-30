import { ConnectionOptions, createConnection, createPool, PoolConnection } from 'mysql2/promise';
import { createLineUsersTableSql } from './line_users';
import { createChatSummariesTableSql } from './chat_history';

const
    userConnectionOptions: ConnectionOptions = {
        host: process.env.MYSQL_HOST,
        port: parseInt(process.env.MYSQL_PORT ?? '3306'),
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE
    },
    userPool = createPool(userConnectionOptions);

export async function initDatabase() {
    console.log(`[${new Date().toISOString()}] [INFO] [initDatabase] - Function start`);
    const
        connectionOptions: ConnectionOptions = {
            host: process.env.MYSQL_HOST,
            port: parseInt(process.env.MYSQL_PORT ?? '3306'),
            user: 'root',
            password: process.env.MYSQL_ROOT_PASSWORD
        };

    console.log(`[${new Date().toISOString()}] [INFO] [initDatabase] - Connecting to MySQL as root`);
    const connection = await createConnection(connectionOptions);

    const createDatabaseSql = `CREATE DATABASE IF NOT EXISTS \`${process.env.MYSQL_DATABASE}\`;`,
        createUserSql = `CREATE USER IF NOT EXISTS '${process.env.MYSQL_USER}'@'%' IDENTIFIED WITH sha256_password BY '${process.env.MYSQL_PASSWORD}';`,
        grantUsageSql = `GRANT USAGE ON *.* TO '${process.env.MYSQL_USER}'@'%';`,
        alterUserSql = `ALTER USER '${process.env.MYSQL_USER}'@'%' REQUIRE NONE WITH MAX_QUERIES_PER_HOUR 0 MAX_CONNECTIONS_PER_HOUR 0 MAX_UPDATES_PER_HOUR 0 MAX_USER_CONNECTIONS 0;`,
        grantAllPrivilegesSql = `GRANT ALL PRIVILEGES ON \`${process.env.MYSQL_DATABASE}\`.* TO '${process.env.MYSQL_USER}'@'%';`;

    await connection.beginTransaction();
    console.log(`[${new Date().toISOString()}] [INFO] [initDatabase] - Transaction started for database and user creation`);
    try {
        console.log(`[${new Date().toISOString()}] [DEBUG] [initDatabase] - Creating database`);
        await connection.execute(createDatabaseSql);
        console.log(`[${new Date().toISOString()}] [DEBUG] [initDatabase] - Creating user`);
        await connection.execute(createUserSql);
        console.log(`[${new Date().toISOString()}] [DEBUG] [initDatabase] - Granting USAGE privileges`);
        await connection.execute(grantUsageSql);
        console.log(`[${new Date().toISOString()}] [DEBUG] [initDatabase] - Altering user settings`);
        await connection.execute(alterUserSql);
        console.log(`[${new Date().toISOString()}] [DEBUG] [initDatabase] - Granting ALL PRIVILEGES on database`);
        await connection.execute(grantAllPrivilegesSql);

        await connection.commit();
        console.log(`[${new Date().toISOString()}] [INFO] [initDatabase] - Database and user initialization committed successfully`);
    } catch (error) {
        await connection.rollback();
        console.error(`[${new Date().toISOString()}] [ERROR] [initDatabase] - Error during database/user initialization, rolled back | ${String(error)}`);
        throw error;
    } finally {
        await connection.end();
        console.log(`[${new Date().toISOString()}] [INFO] [initDatabase] - Root connection closed`);
    }
}

export async function initTables() {
    console.log(`[${new Date().toISOString()}] [INFO] [tablesInit] - Function start`);
    console.log(`[${new Date().toISOString()}] [INFO] [tablesInit] - Getting connection from pool`);
    const connection: PoolConnection = await userPool.getConnection();
    await connection.beginTransaction();
    console.log(`[${new Date().toISOString()}] [INFO] [tablesInit] - Transaction started for table creation`);
    try {
        console.log(`[${new Date().toISOString()}] [DEBUG] [tablesInit] - Creating line_users table`);
        await connection.execute(createLineUsersTableSql);
        console.log(`[${new Date().toISOString()}] [DEBUG] [tablesInit] - Creating chat_summaries table`);
        await connection.execute(createChatSummariesTableSql);
        await connection.commit();
        console.log(`[${new Date().toISOString()}] [INFO] [tablesInit] - Table creation committed successfully`);
    } catch (error) {
        await connection.rollback();
        console.error(`[${new Date().toISOString()}] [ERROR] [tablesInit] - Error during table creation, rolled back | ${String(error)}`);
        throw error;
    } finally {
        connection.release();
        console.log(`[${new Date().toISOString()}] [INFO] [tablesInit] - Pool connection released`);
    }
}

export default userPool;