import userClient, { databaseName } from ".";

export async function insertLineMessageEventLog(event: any) {
    try {
        await userClient.connect();
        const database = userClient.db(databaseName);
        const collection = database.collection('line_message_event_logs');
        await collection.insertOne(event);
        console.log(`[${new Date().toISOString()}] [INFO] [insertLineMessageEventLog] - Inserted event log: ${JSON.stringify(event)}`);
    } catch (err) {
        console.error(`[${new Date().toISOString()}] [ERROR] [insertLineMessageEventLog] - Error inserting event log: ${err}`);
    } finally {
        await userClient.close();
    }
}