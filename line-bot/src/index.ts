import app from '@/app';
import { initDatabase, tablesInit } from '@/database/mysql';

initDatabase().finally(() => tablesInit().catch(console.error)).catch(console.error);

const port: number = parseInt(process.env.PORT ?? '3000');

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});