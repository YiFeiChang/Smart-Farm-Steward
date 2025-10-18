import { ConnectionOptions, createConnection, createPool } from 'mysql2/promise';

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
    const
        connectionOptions: ConnectionOptions = {
            host: process.env.MYSQL_HOST,
            port: parseInt(process.env.MYSQL_PORT ?? '3306'),
            user: 'root',
            password: process.env.MYSQL_ROOT_PASSWORD
        };

    console.log('Connecting to MySQL as root...');
    const connection = await createConnection(connectionOptions);

    const createDatabaseSql = `CREATE DATABASE IF NOT EXISTS \`${process.env.MYSQL_DATABASE}\`;`,
        createUserSql = `CREATE USER IF NOT EXISTS '${process.env.MYSQL_USER}'@'%' IDENTIFIED WITH sha256_password BY '${process.env.MYSQL_PASSWORD}';`,
        grantUsageSql = `GRANT USAGE ON *.* TO '${process.env.MYSQL_USER}'@'%';`,
        alterUserSql = `ALTER USER '${process.env.MYSQL_USER}'@'%' REQUIRE NONE WITH MAX_QUERIES_PER_HOUR 0 MAX_CONNECTIONS_PER_HOUR 0 MAX_UPDATES_PER_HOUR 0 MAX_USER_CONNECTIONS 0;`,
        grantAllPrivilegesSql = `GRANT ALL PRIVILEGES ON \`${process.env.MYSQL_DATABASE}\`.* TO '${process.env.MYSQL_USER}'@'%';`;

    await connection.beginTransaction();
    console.log('Transaction started for database and user creation...');
    try {
        console.log('Creating database...');
        await connection.execute(createDatabaseSql);
        console.log('Creating user...');
        await connection.execute(createUserSql);
        console.log('Granting USAGE privileges...');
        await connection.execute(grantUsageSql);
        console.log('Altering user settings...');
        await connection.execute(alterUserSql);
        console.log('Granting ALL PRIVILEGES on database...');
        await connection.execute(grantAllPrivilegesSql);

        await connection.commit();
        console.log('Database and user initialization committed successfully.');
    } catch (error) {
        await connection.rollback();
        console.error('Error during database/user initialization, rolled back.', error);
        throw error;
    } finally {
        await connection.end();
        console.log('Root connection closed.');
    }
}

export async function tablesInit() {
    const createLineUsersTableSql = `
CREATE TABLE IF NOT EXISTS line_users (
    user_id VARCHAR(50) NOT NULL PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL,
    picture_url TEXT,
    status_message TEXT,
    language VARCHAR(10),
    created_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
`.trim();

    console.log('Getting connection from pool...');
    const connection = await userPool.getConnection();
    await connection.beginTransaction();
    console.log('Transaction started for table creation...');
    try {
        console.log('Creating linr_users table...');
        await connection.execute(createLineUsersTableSql);
        await connection.commit();
        console.log('Table creation committed successfully.');
    } catch (error) {
        await connection.rollback();
        console.error('Error during table creation, rolled back.', error);
        throw error;
    } finally {
        connection.release();
        console.log('Pool connection released.');
    }
}
