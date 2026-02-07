import express from 'express';
import cookieParser from 'cookie-parser';

import patientRoutes from './routes/patient';
import adminRoutes from './routes/admin';
import automatedRoutes from './routes/automated';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cookieParser());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routes
app.use('/api/patient', patientRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/automated', automatedRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
export const startServer = () => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log('');
        console.log('API Endpoints:');
        console.log('  Health:     GET  /health');
        console.log('');
        console.log('  Patient API (requires patientId cookie):');
        console.log('    GET  /api/patient/diet-order');
        console.log('    GET  /api/patient/available-meals/:mealTime');
        console.log('    GET  /api/patient/tray-orders');
        console.log('    POST /api/patient/tray-orders');
        console.log('    DELETE /api/patient/tray-orders');
        console.log('');
        console.log('  Admin API (requires Bearer token):');
        console.log('    POST /api/admin/auth/register');
        console.log('    POST /api/admin/auth/login');
        console.log('    CRUD /api/admin/patients');
        console.log('    CRUD /api/admin/recipes');
        console.log('    CRUD /api/admin/diet-orders');
        console.log('    CRUD /api/admin/patient-diet-orders');
        console.log('    CRUD /api/admin/tray-orders');
        console.log('');
        console.log('  Automated API (requires Bearer token):');
        console.log('    GET  /api/automated/diet-order/:patientId');
        console.log('    GET  /api/automated/available-meals/:patientId/:mealTime');
        console.log('    POST /api/automated/execute-prep/:mealTime');
    });
};

export { app };

// Run server if this file is executed directly
if (require.main === module) {
    startServer();
}
