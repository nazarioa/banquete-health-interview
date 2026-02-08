import { Router } from 'express';
import { authenticatePatient } from '../middleware/auth';
import * as PatientApi from '../internal/patientApi';
import { MealTimeInput } from '../internal/types';

const router = Router();

// All patient routes require authentication via patientId cookie
router.use(authenticatePatient);

/**
 * GET /patient/diet-order
 * Returns the patient's diet order with calories consumed today
 */
router.get('/diet-order', async (req, res) => {
    try {
        const result = await PatientApi.getDietOrder(req.patientId!);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

/**
 * GET /patient/available-meals/:mealTime
 * Returns recipes available within the patient's remaining calorie budget
 */
// TODO: naz maybe change this to include query param for category...
router.get('/available-meals/:mealTime', async (req, res) => {
    try {
        const mealTime = req.params.mealTime as MealTimeInput;
        if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(mealTime)) {
            res.status(400).json({ error: 'Invalid mealTime. Must be breakfast, lunch, dinner, or snack' });
            return;
        }

        const result = await PatientApi.getAvailableRecipes(req.patientId!);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

/**
 * GET /patient/tray-orders
 * Returns scheduled tray orders for the patient
 * Query params: mealTime (optional), showPast (optional, default true)
 */
router.get('/tray-orders', async (req, res) => {
    try {
        const mealTime = req.query.mealTime as MealTimeInput | undefined;
        const showPast = req.query.showPast !== 'false';

        if (mealTime && !['breakfast', 'lunch', 'dinner', 'snack'].includes(mealTime)) {
            res.status(400).json({ error: 'Invalid mealTime. Must be breakfast, lunch, dinner, or snack' });
            return;
        }

        const result = await PatientApi.getTrayOrders(req.patientId!, mealTime, showPast);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

/**
 * POST /patient/tray-orders
 * Creates one or more tray orders for the patient
 * Body: { trays: [{ scheduled_for: Date, mealTime: string, recipe_ids: string[] }] }
 */
router.post('/tray-orders', async (req, res) => {
    try {
        const result = await PatientApi.postTrayOrders(req.patientId!, req.body);
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

/**
 * DELETE /patient/tray-orders
 * Deletes specified tray orders belonging to the patient
 * Body: { trayOrderIds: string[] }
 */
router.delete('/tray-orders', async (req, res) => {
    try {
        const { trayOrderIds } = req.body;
        if (!trayOrderIds || !Array.isArray(trayOrderIds)) {
            res.status(400).json({ error: 'trayOrderIds must be an array' });
            return;
        }

        const result = await PatientApi.deleteTrayOrders(req.patientId!, trayOrderIds);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

export default router;
