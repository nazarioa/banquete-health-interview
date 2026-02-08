import express from 'express';
import cookieParser from 'cookie-parser';

import patientRoutes from './server/routes/patient';
import adminRoutes from './server/routes/admin';
import automatedRoutes from './server/routes/automated';

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
      // Startup Instruction
      console.log(`Server running on http://localhost:${PORT}
      API Endpoints:
        Health:     GET  /health

        Patient API (requires patientId cookie):
          GET  /api/patient/diet-order
          GET  /api/patient/available-meals/:mealTime
          GET  /api/patient/tray-orders
          POST /api/patient/tray-orders
          DELETE /api/patient/tray-orders

        Admin API (requires Bearer token):
          POST /api/admin/auth/register
          POST /api/admin/auth/login
          CRUD /api/admin/patients
          CRUD /api/admin/recipes
          CRUD /api/admin/diet-orders
          CRUD /api/admin/patient-diet-orders
          CRUD /api/admin/tray-orders

        Automated API (requires Bearer token):
          GET  /api/automated/diet-order/:patientId
          GET  /api/automated/available-meals/:patientId/:mealTime
          POST /api/automated/execute-prep/:mealTime
       `);
   });
};

export { app };

// Run server if this file is executed directly
if (require.main === module) {
   startServer();
}
