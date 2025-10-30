import { Db, MongoClient } from 'mongodb';

const
    rootUri = `mongodb://${process.env.MONGO_ADMINUSERNAME}:${process.env.MONGO_ADMINPASSWORD}@${process.env.MONGO_HOST}:${process.env.MONGO_PORT}`,
    userUri = `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_HOST}:${process.env.MONGO_PORT}/${process.env.MONGO_DATABASE}/?authSource=${process.env.MONGO_DATABASE}`,
    userClient: MongoClient = new MongoClient(userUri),
    user = process.env.MONGO_USER,
    password = process.env.MONGO_PASSWORD,
    collectionNames: string[] = ['line_message_event_logs'];

export const databaseName = process.env.MONGO_DATABASE;

export async function initDatabase() {
    const client = new MongoClient(rootUri);
    console.log(`[${new Date().toISOString()}] [INFO] [initDatabase] - Starting database initialization`);
    await client.connect();
    console.log(`[${new Date().toISOString()}] [INFO] [initDatabase] - Connected to MongoDB`);
    try {
        const database: Db = client.db(databaseName);
        console.log(`[${new Date().toISOString()}] [DEBUG] [initDatabase] - Selected database: ${databaseName}`);
        const usersInfo = await database.command({ usersInfo: user });
        console.log(`[${new Date().toISOString()}] [DEBUG] [initDatabase] - Fetched usersInfo for user: ${user}`);
        if (usersInfo.users.length === 0) {
            console.log(`[${new Date().toISOString()}] [INFO] [initDatabase] - User ${user} does not exist, creating user`);
            await database.command({
                createUser: user,
                pwd: password,
                roles: [{ role: 'readWrite', db: databaseName }]
            });
            console.log(`[${new Date().toISOString()}] [INFO] [initDatabase] - Created user: ${user} with readWrite on ${databaseName}`);
        } else {
            console.log(`[${new Date().toISOString()}] [INFO] [initDatabase] - User ${user} already exists`);
        }
    } catch (err) {
        console.error(`[${new Date().toISOString()}] [ERROR] [initDatabase] - MongoDB initialization error | error: ${err}`);
    } finally {
        await client.close();
        console.log(`[${new Date().toISOString()}] [INFO] [initDatabase] - MongoDB connection closed`);
    }
}

export async function initCollections() {
    console.log(`[${new Date().toISOString()}] [INFO] [initCollections] - Starting collection initialization`);
    await userClient.connect();
    console.log(`[${new Date().toISOString()}] [INFO] [initCollections] - Connected to MongoDB`);
    try {
        const database: Db = userClient.db(databaseName);
        console.log(`[${new Date().toISOString()}] [DEBUG] [initCollections] - Selected database: ${databaseName}`);
        const collections = await database.listCollections({ name: { $regex: new RegExp(`^(?:${collectionNames.join('|')})$`) } }).toArray();
        for (const collection of collections) {
            console.log(`[${new Date().toISOString()}] [DEBUG] [initCollections] - Checked existence of collection: ${collection.name}`);
            if (collections.length === 0) {
                await database.createCollection(collection.name);
                console.log(`[${new Date().toISOString()}] [INFO] [initCollections] - Created collection: ${collection.name}`);
            } else {
                console.log(`[${new Date().toISOString()}] [INFO] [initCollections] - Collection ${collection.name} already exists`);
            }
        }
    } catch (err) {
        console.error(`[${new Date().toISOString()}] [ERROR] [initCollections] - MongoDB initialization error | error: ${err}`);
    } finally {
        await userClient.close();
        console.log(`[${new Date().toISOString()}] [INFO] [initCollections] - MongoDB connection closed`);
    }
}

export default userClient;