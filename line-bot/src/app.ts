import express, { Request, Response, NextFunction, Express } from 'express';
import webhookRouter from '@/routes/webhook';

const app: Express = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/webhook', webhookRouter);

export default app;