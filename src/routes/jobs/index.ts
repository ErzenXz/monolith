import { Hono } from 'hono';
import statusRoutes from './status.js';
import deleteRoutes from './delete.js';
import listRoutes from './list.js';

const app = new Hono();

app.route('/status', statusRoutes);
app.route('/delete', deleteRoutes);
app.route('', listRoutes);

export default app;
