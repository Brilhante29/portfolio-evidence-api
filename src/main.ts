import 'reflect-metadata';
import { createApplication } from './bootstrap.js';

const port = Number.parseInt(process.env['PORT'] ?? '3000', 10);
const host = process.env['HOST'] ?? '0.0.0.0';

const app = await createApplication();
await app.listen(port, host);
