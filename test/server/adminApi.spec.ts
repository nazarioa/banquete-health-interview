import { db } from '../../src/db';
import {
    createPatient,
    getPatient,
    getAllPatients,
    updatePatient,
    deletePatient,
    createRecipe,
    getRecipe,
    getAllRecipes,
    updateRecipe,
    deleteRecipe,
    createDietOrder,
    getDietOrderById,
    getAllDietOrders,
    updateDietOrder,
    deleteDietOrder,
    createPatientDietOrder,
    getPatientDietOrder,
    getPatientDietOrderByPatient,
    deletePatientDietOrder,
    createTrayOrder,
    getTrayOrder,
    getAllTrayOrders,
    updateTrayOrder,
    deleteTrayOrder,
} from '../../src/server/internal/adminApi';

describe('AdminApi', () => {
    describe('Patient CRUD', () => {
        it('creates a new patient', async () => {
            const result = await createPatient({ name: 'New Patient' });

            expect(result.id).toBeDefined();
            expect(result.name).toBe('New Patient');
        });

        it('retrieves a patient by id', async () => {
            const created = await createPatient({ name: 'Get Patient' });

            const result = await getPatient(created.id);

            expect(result).not.toBeNull();
            expect(result?.name).toBe('Get Patient');
        });

        it('retrieves all patients', async () => {
            await createPatient({ name: 'Patient 1' });
            await createPatient({ name: 'Patient 2' });

            const result = await getAllPatients();

            // Includes seed data patient plus our two new ones
            expect(result.length).toBeGreaterThanOrEqual(2);
        });

        it('updates a patient', async () => {
            const created = await createPatient({ name: 'Original Name' });

            const result = await updatePatient({ id: created.id, name: 'Updated Name' });

            expect(result.name).toBe('Updated Name');
        });

        it('deletes a patient', async () => {
            const created = await createPatient({ name: 'Delete Patient' });

            await deletePatient(created.id);

            const found = await getPatient(created.id);
            expect(found).toBeNull();
        });

        it('handles cascade delete for patient with orders', async () => {
            const patient = await createPatient({ name: 'Cascade Patient' });
            const dietOrder = await createDietOrder({
                name: 'Cascade Diet',
                minimumCalories: 1500,
                maximumCalories: 2500,
            });
            await createPatientDietOrder({
                patientId: patient.id,
                dietOrderId: dietOrder.id,
            });

            const recipe = await createRecipe({
                name: 'Cascade Recipe',
                category: 'Entrees',
                calories: 400,
            });

            await createTrayOrder({
                patientId: patient.id,
                scheduledFor: new Date(),
                mealTime: 'lunch',
                recipeIds: [recipe.id],
            });

            // Should not throw
            await deletePatient(patient.id);

            const found = await getPatient(patient.id);
            expect(found).toBeNull();
        });
    });

    describe('Recipe CRUD', () => {
        it('creates a new recipe', async () => {
            const result = await createRecipe({
                name: 'New Recipe',
                category: 'Entrees',
                calories: 500,
            });

            expect(result.id).toBeDefined();
            expect(result.name).toBe('New Recipe');
            expect(result.category).toBe('Entrees');
            expect(result.calories).toBe(500);
        });

        it('retrieves a recipe by id', async () => {
            const created = await createRecipe({
                name: 'Get Recipe',
                category: 'Sides',
                calories: 200,
            });

            const result = await getRecipe(created.id);

            expect(result).not.toBeNull();
            expect(result?.name).toBe('Get Recipe');
        });

        it('retrieves all recipes', async () => {
            await createRecipe({ name: 'Recipe A', category: 'Entrees', calories: 400 });
            await createRecipe({ name: 'Recipe B', category: 'Sides', calories: 150 });

            const result = await getAllRecipes();

            // Includes seed data recipes plus our two new ones
            expect(result.length).toBeGreaterThanOrEqual(2);
        });

        it('updates a recipe', async () => {
            const created = await createRecipe({
                name: 'Original Recipe',
                category: 'Entrees',
                calories: 400,
            });

            const result = await updateRecipe({
                id: created.id,
                name: 'Updated Recipe',
                calories: 450,
            });

            expect(result.name).toBe('Updated Recipe');
            expect(result.calories).toBe(450);
        });

        it('deletes a recipe', async () => {
            const created = await createRecipe({
                name: 'Delete Recipe',
                category: 'Desserts',
                calories: 300,
            });

            await deleteRecipe(created.id);

            const found = await getRecipe(created.id);
            expect(found).toBeNull();
        });
    });

    describe('DietOrder CRUD', () => {
        it('creates a new diet order', async () => {
            const result = await createDietOrder({
                name: 'New Diet',
                minimumCalories: 1200,
                maximumCalories: 1800,
            });

            expect(result.id).toBeDefined();
            expect(result.name).toBe('New Diet');
            expect(result.minimumCalories).toBe(1200);
            expect(result.maximumCalories).toBe(1800);
        });

        it('retrieves a diet order by id', async () => {
            const created = await createDietOrder({
                name: 'Get Diet',
                minimumCalories: 1500,
                maximumCalories: 2500,
            });

            const result = await getDietOrderById(created.id);

            expect(result).not.toBeNull();
            expect(result?.name).toBe('Get Diet');
        });

        it('retrieves all diet orders', async () => {
            await createDietOrder({ name: 'Diet 1', minimumCalories: 1000, maximumCalories: 1500 });
            await createDietOrder({ name: 'Diet 2', minimumCalories: 2000, maximumCalories: 2500 });

            const result = await getAllDietOrders();

            // Includes seed data plus our two new ones
            expect(result.length).toBeGreaterThanOrEqual(2);
        });

        it('updates a diet order', async () => {
            const created = await createDietOrder({
                name: 'Original Diet',
                minimumCalories: 1500,
                maximumCalories: 2000,
            });

            const result = await updateDietOrder({
                id: created.id,
                name: 'Updated Diet',
                maximumCalories: 2200,
            });

            expect(result.name).toBe('Updated Diet');
            expect(result.maximumCalories).toBe(2200);
        });

        it('deletes a diet order', async () => {
            const created = await createDietOrder({
                name: 'Delete Diet',
                minimumCalories: 1500,
                maximumCalories: 2500,
            });

            await deleteDietOrder(created.id);

            const found = await getDietOrderById(created.id);
            expect(found).toBeNull();
        });
    });

    describe('PatientDietOrder CRUD', () => {
        it('creates a patient diet order association', async () => {
            const patient = await createPatient({ name: 'PDO Patient' });
            const dietOrder = await createDietOrder({
                name: 'PDO Diet',
                minimumCalories: 1500,
                maximumCalories: 2500,
            });

            const result = await createPatientDietOrder({
                patientId: patient.id,
                dietOrderId: dietOrder.id,
            });

            expect(result.id).toBeDefined();
            expect(result.patientId).toBe(patient.id);
            expect(result.dietOrderId).toBe(dietOrder.id);
        });

        it('retrieves patient diet order by patient id', async () => {
            const patient = await createPatient({ name: 'Get PDO Patient' });
            const dietOrder = await createDietOrder({
                name: 'Get PDO Diet',
                minimumCalories: 1500,
                maximumCalories: 2500,
            });
            await createPatientDietOrder({
                patientId: patient.id,
                dietOrderId: dietOrder.id,
            });

            const result = await getPatientDietOrderByPatient(patient.id);

            expect(result).not.toBeNull();
            expect(result?.patientId).toBe(patient.id);
        });

        it('deletes a patient diet order', async () => {
            const patient = await createPatient({ name: 'Delete PDO Patient' });
            const dietOrder = await createDietOrder({
                name: 'Delete PDO Diet',
                minimumCalories: 1500,
                maximumCalories: 2500,
            });
            const pdo = await createPatientDietOrder({
                patientId: patient.id,
                dietOrderId: dietOrder.id,
            });

            await deletePatientDietOrder(pdo.id);

            const found = await getPatientDietOrder(pdo.id);
            expect(found).toBeNull();
        });
    });

    describe('TrayOrder CRUD', () => {
        it('creates a tray order with recipes', async () => {
            const patient = await createPatient({ name: 'TO Patient' });
            const recipe = await createRecipe({
                name: 'TO Recipe',
                category: 'Entrees',
                calories: 400,
            });

            const result = await createTrayOrder({
                patientId: patient.id,
                scheduledFor: new Date(),
                mealTime: 'lunch',
                recipeIds: [recipe.id],
            });

            expect(result.id).toBeDefined();
            expect(result.patientId).toBe(patient.id);
            expect(result.mealTime).toBe('LUNCH');
        });

        it('retrieves a tray order with included recipes', async () => {
            const patient = await createPatient({ name: 'Get TO Patient' });
            const recipe = await createRecipe({
                name: 'Get TO Recipe',
                category: 'Entrees',
                calories: 400,
            });
            const trayOrder = await createTrayOrder({
                patientId: patient.id,
                scheduledFor: new Date(),
                mealTime: 'dinner',
                recipeIds: [recipe.id],
            });

            const result = await getTrayOrder(trayOrder.id);

            expect(result).not.toBeNull();
            expect(result?.recipes.length).toBe(1);
            expect(result?.recipes[0].recipe.name).toBe('Get TO Recipe');
        });

        it('retrieves all tray orders', async () => {
            const patient = await createPatient({ name: 'All TO Patient' });
            const recipe = await createRecipe({
                name: 'All TO Recipe',
                category: 'Entrees',
                calories: 400,
            });

            await createTrayOrder({
                patientId: patient.id,
                scheduledFor: new Date(),
                mealTime: 'breakfast',
                recipeIds: [recipe.id],
            });

            const result = await getAllTrayOrders();

            // Includes seed data plus our new one
            expect(result.length).toBeGreaterThanOrEqual(1);
        });

        it('updates a tray order', async () => {
            const patient = await createPatient({ name: 'Update TO Patient' });
            const recipe = await createRecipe({
                name: 'Update TO Recipe',
                category: 'Entrees',
                calories: 400,
            });
            const trayOrder = await createTrayOrder({
                patientId: patient.id,
                scheduledFor: new Date(),
                mealTime: 'breakfast',
                recipeIds: [recipe.id],
            });

            const result = await updateTrayOrder({
                id: trayOrder.id,
                mealTime: 'lunch',
            });

            expect(result.mealTime).toBe('LUNCH');
        });

        it('deletes a tray order and associated recipes', async () => {
            const patient = await createPatient({ name: 'Delete TO Patient' });
            const recipe = await createRecipe({
                name: 'Delete TO Recipe',
                category: 'Entrees',
                calories: 400,
            });
            const trayOrder = await createTrayOrder({
                patientId: patient.id,
                scheduledFor: new Date(),
                mealTime: 'lunch',
                recipeIds: [recipe.id],
            });

            await deleteTrayOrder(trayOrder.id);

            const found = await getTrayOrder(trayOrder.id);
            expect(found).toBeNull();

            // Verify associated recipes were also deleted
            const orphanedRecipes = await db.trayOrderRecipe.findMany({
                where: { trayOrderId: trayOrder.id },
            });
            expect(orphanedRecipes.length).toBe(0);
        });
    });
});
