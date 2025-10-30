import app from '@/app';
import { initDatabase as initMySqlDatabase, initTables as initMySqlTables } from '@/database/mysql';
import { initDatabase as initMongoDatabase, initCollections as initMongoCollections } from '@/database/mongo';

initMySqlDatabase().finally(() => initMySqlTables().catch(console.error)).catch(console.error);
initMongoDatabase().finally(() => initMongoCollections().catch(console.error)).catch(console.error);

const port: number = parseInt(process.env.PORT ?? '3000');

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});