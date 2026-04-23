import express from 'express';
import cors from 'cors';
import { requestLogger } from './middleware/logger';
import usersRouter from './routes/users';
import subscriptionsRouter from './routes/subscriptions';
import usageRouter from './routes/usage';

export const app = express();

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());
app.use(requestLogger);

// Routes
app.use('/users', usersRouter);
app.use('/subscriptions', subscriptionsRouter);
app.use('/usage', usageRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Generic error handler (must be last, 4-param signature required by Express)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[UNHANDLED]', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Only bind the port when not under test
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT ?? 3001;
  app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
}
