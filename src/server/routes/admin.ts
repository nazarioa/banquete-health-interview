import { Router } from 'express';
import { db } from '../../db';
import { authenticateAdmin, hashPassword, comparePassword, generateToken } from '../middleware/auth';
import * as AdminApi from '../internal/adminApi';
import { MealTimeInput } from '../internal/types';

const router = Router();

// ============================================================================
// Authentication Routes (public)
// ============================================================================

/**
 * POST /admin/auth/register
 * Register a new admin
 * Body: { email: string, name: string, password: string }
 */
router.post('/auth/register', async (req, res) => {
    try {
        const { email, name, password } = req.body;

        if (!email || !name || !password) {
            res.status(400).json({ error: 'email, name, and password are required' });
            return;
        }

        // Check if email already exists
        const existing = await db.admin.findUnique({ where: { email } });
        if (existing) {
            res.status(400).json({ error: 'Email already registered' });
            return;
        }

        // Hash password and create admin
        const hashedPassword = await hashPassword(password);
        const admin = await db.admin.create({
            data: { email, name, password: hashedPassword },
        });

        const token = generateToken(admin.id);

        res.status(201).json({
            admin: { id: admin.id, email: admin.email, name: admin.name },
            token,
        });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * POST /admin/auth/login
 * Login as an admin
 * Body: { email: string, password: string }
 */
router.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ error: 'email and password are required' });
            return;
        }

        const admin = await db.admin.findUnique({ where: { email } });
        if (!admin) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const isValid = await comparePassword(password, admin.password);
        if (!isValid) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const token = generateToken(admin.id);

        res.json({
            admin: { id: admin.id, email: admin.email, name: admin.name },
            token,
        });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// ============================================================================
// Protected Routes (require authentication)
// ============================================================================
router.use(authenticateAdmin);

// --- Patient CRUD ---

router.post('/patients', async (req, res) => {
    try {
        const result = await AdminApi.createPatient(req.body);
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

router.get('/patients', async (req, res) => {
    try {
        const result = await AdminApi.getAllPatients();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.get('/patients/:id', async (req, res) => {
    try {
        const result = await AdminApi.getPatient(req.params.id);
        if (!result) {
            res.status(404).json({ error: 'Patient not found' });
            return;
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.put('/patients/:id', async (req, res) => {
    try {
        const result = await AdminApi.updatePatient({ id: req.params.id, ...req.body });
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

router.delete('/patients/:id', async (req, res) => {
    try {
        await AdminApi.deletePatient(req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

// --- Recipe CRUD ---

router.post('/recipes', async (req, res) => {
    try {
        const result = await AdminApi.createRecipe(req.body);
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

router.get('/recipes', async (req, res) => {
    try {
        const result = await AdminApi.getAllRecipes();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.get('/recipes/:id', async (req, res) => {
    try {
        const result = await AdminApi.getRecipe(req.params.id);
        if (!result) {
            res.status(404).json({ error: 'Recipe not found' });
            return;
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.put('/recipes/:id', async (req, res) => {
    try {
        const result = await AdminApi.updateRecipe({ id: req.params.id, ...req.body });
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

router.delete('/recipes/:id', async (req, res) => {
    try {
        await AdminApi.deleteRecipe(req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

// --- DietOrder CRUD ---

router.post('/diet-orders', async (req, res) => {
    try {
        const result = await AdminApi.createDietOrder(req.body);
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

router.get('/diet-orders', async (req, res) => {
    try {
        const result = await AdminApi.getAllDietOrders();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.get('/diet-orders/:id', async (req, res) => {
    try {
        const result = await AdminApi.getDietOrderById(req.params.id);
        if (!result) {
            res.status(404).json({ error: 'DietOrder not found' });
            return;
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.put('/diet-orders/:id', async (req, res) => {
    try {
        const result = await AdminApi.updateDietOrder({ id: req.params.id, ...req.body });
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

router.delete('/diet-orders/:id', async (req, res) => {
    try {
        await AdminApi.deleteDietOrder(req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

// --- PatientDietOrder CRUD ---

router.post('/patient-diet-orders', async (req, res) => {
    try {
        const result = await AdminApi.createPatientDietOrder(req.body);
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

router.get('/patient-diet-orders/:id', async (req, res) => {
    try {
        const result = await AdminApi.getPatientDietOrder(req.params.id);
        if (!result) {
            res.status(404).json({ error: 'PatientDietOrder not found' });
            return;
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.get('/patient-diet-orders/by-patient/:patientId', async (req, res) => {
    try {
        const result = await AdminApi.getPatientDietOrderByPatient(req.params.patientId);
        if (!result) {
            res.status(404).json({ error: 'PatientDietOrder not found' });
            return;
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.delete('/patient-diet-orders/:id', async (req, res) => {
    try {
        await AdminApi.deletePatientDietOrder(req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

// --- TrayOrder CRUD ---

router.post('/tray-orders', async (req, res) => {
    try {
        const { patientId, scheduledFor, mealTime, recipeIds } = req.body;
        const result = await AdminApi.createTrayOrder({
            patientId,
            scheduledFor: new Date(scheduledFor),
            mealTime: mealTime as MealTimeInput,
            recipeIds,
        });
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

router.get('/tray-orders', async (req, res) => {
    try {
        const result = await AdminApi.getAllTrayOrders();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.get('/tray-orders/:id', async (req, res) => {
    try {
        const result = await AdminApi.getTrayOrder(req.params.id);
        if (!result) {
            res.status(404).json({ error: 'TrayOrder not found' });
            return;
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.put('/tray-orders/:id', async (req, res) => {
    try {
        const result = await AdminApi.updateTrayOrder({
            id: req.params.id,
            scheduledFor: req.body.scheduledFor ? new Date(req.body.scheduledFor) : undefined,
            mealTime: req.body.mealTime as MealTimeInput | undefined,
        });
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

router.delete('/tray-orders/:id', async (req, res) => {
    try {
        await AdminApi.deleteTrayOrder(req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

export default router;
