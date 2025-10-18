import express, { Request, Response, NextFunction, Express } from 'express';
import webhookRouter from '@/routes/webhook';


const app: Express = express();


app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// routes
app.use('/webhook', webhookRouter);


// basic 404
app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
});


// error handler
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
});


export default app;