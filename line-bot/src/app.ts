import express, { Request, Response, NextFunction, Express } from 'express';
import path from 'path';
import webhookRouter from '@/routes/webhook';
import testRouter from '@/routes/test';

const app: Express = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/webhook', webhookRouter);
app.use('/test', testRouter);

export default app;