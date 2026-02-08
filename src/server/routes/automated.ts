import { Router } from 'express';
import { authenticateAdmin } from '../middleware/auth';
import * as AutomatedApi from '../internal/automatedApi';

const router = Router();

// Automated API routes require admin authentication
// In production, you might use a different auth mechanism (API key, internal network, etc.)
router.use(authenticateAdmin);

/**
 * GET /automated/diet-order/:patientId
 * Returns the diet order for a specific patient
 */
router.get('/diet-order/:patientId', async (req, res) => {
   try {
      const result = await AutomatedApi.getAdminDietOrder(req.params.patientId);
      res.json(result);
   } catch (error) {
      res.status(400).json({ error: (error as Error).message });
   }
});

/**
 * GET /automated/available-meals/:patientId
 * Returns available meals for a specific patient and meal time
 */
// TODO: Add query param forItemCategory
router.get('/available-meals/:patientId', async (req, res) => {
   try {
      /*
        if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(mealTime)) {
            res.status(400).json({ error: 'Invalid mealTime. Must be breakfast, lunch, dinner, or snack' });
            return;
        }
        */

      const result = await AutomatedApi.getAvailableRecipes(req.params.patientId);
      res.json(result);
   } catch (error) {
      res.status(400).json({ error: (error as Error).message });
   }
});

/**
 * POST /automated/execute-prep/:mealTime
 * Executes the smart ordering system for a specific meal time
 * Creates tray orders for patients who haven't ordered
 */
router.post('/execute-prep/:mealTime', async (req, res) => {
   try {
      const mealTime = req.params.mealTime as 'breakfast' | 'lunch' | 'dinner';
      if (!['breakfast', 'lunch', 'dinner'].includes(mealTime)) {
         res.status(400).json({
            error: 'Invalid mealTime. Must be breakfast, lunch, or dinner',
         });
         return;
      }

      const result = await AutomatedApi.executePrep(mealTime);
      res.json(result);
   } catch (error) {
      res.status(500).json({ error: (error as Error).message });
   }
});

export default router;
