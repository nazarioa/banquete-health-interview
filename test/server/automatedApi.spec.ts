import { db } from '../../src/db';
import {
   executePrep,
   getAdminDietOrder,
   getAvailableRecipes,
} from '../../src/server/internal/automatedApi';
import { getDietOrder } from '../../src/server/internal/patientApi';

describe('AutomatedApi', () => {
   // Helper to create a patient with diet order
   const createPatientWithDietOrder = async (name: string, minCal: number, maxCal: number) => {
      const patient = await db.patient.create({ data: { name } });
      const dietOrder = await db.dietOrder.create({
         data: {
            name: `${name} Diet`,
            minimumCalories: minCal,
            maximumCalories: maxCal,
         },
      });
      await db.patientDietOrder.create({
         data: {
            patientId: patient.id,
            dietOrderId: dietOrder.id,
         },
      });
      return patient;
   };

   describe('getAdminDietOrder', () => {
      it('returns same result as patientApi.getDietOrder', async () => {
         const patient = await createPatientWithDietOrder('Admin Test Patient', 1500, 2500);

         const adminResult = await getAdminDietOrder(patient.id);
         const patientResult = await getDietOrder(patient.id);

         expect(adminResult).toEqual(patientResult);
      });
   });

   describe('getAvailableRecipes', () => {
      it('returns available recipes for the patient', async () => {
         const patient = await createPatientWithDietOrder('Meals Test Patient', 1500, 2500);

         await db.recipe.create({
            data: { name: 'Test Recipes', category: 'Entrees', calories: 400 },
         });

         const result = await getAvailableRecipes(patient.id);

         expect(result.recipes.length).toBeGreaterThan(0);
      });
   });

   describe('executePrep', () => {
      describe('order detection', () => {
         it('skips patients who already have orders for the meal', async () => {
            // Clear all existing patients to have controlled test
            await db.trayOrderRecipe.deleteMany();
            await db.trayOrder.deleteMany();
            await db.patientDietOrder.deleteMany();
            await db.patient.deleteMany();

            const patient = await createPatientWithDietOrder('Has Order Patient', 1500, 2500);
            const recipe = await db.recipe.create({
               data: { name: 'Existing Order Recipe', category: 'Entrees', calories: 400 },
            });

            // Create an existing breakfast order for today
            const today = new Date();
            today.setHours(8, 0, 0, 0);
            await db.trayOrder.create({
               data: {
                  patientId: patient.id,
                  scheduledFor: today,
                  mealTime: 'BREAKFAST',
                  recipes: { create: [{ recipeId: recipe.id }] },
               },
            });

            const result = await executePrep('breakfast');

            expect(result.patientsProcessed).toBe(1);
            expect(result.ordersCreated).toBe(0);
         });

         it('creates orders for patients without existing orders', async () => {
            // Clear all existing patients to have controlled test
            await db.trayOrderRecipe.deleteMany();
            await db.trayOrder.deleteMany();
            await db.patientDietOrder.deleteMany();
            await db.patient.deleteMany();

            const patient = await createPatientWithDietOrder('No Order Patient', 1500, 2500);
            await db.recipe.create({
               data: { name: 'Auto Order Recipe', category: 'Entrees', calories: 300 },
            });

            const result = await executePrep('lunch');

            expect(result.patientsProcessed).toBe(1);
            expect(result.ordersCreated).toBe(1);

            // Verify the order was created
            const orders = await db.trayOrder.findMany({
               where: { patientId: patient.id, mealTime: 'LUNCH' },
            });
            expect(orders.length).toBe(1);
         });

         it('handles mix of patients with and without orders', async () => {
            // Clear all existing patients to have controlled test
            await db.trayOrderRecipe.deleteMany();
            await db.trayOrder.deleteMany();
            await db.patientDietOrder.deleteMany();
            await db.patient.deleteMany();

            const patientWithOrder = await createPatientWithDietOrder('With Order', 1500, 2500);
            const patientWithoutOrder = await createPatientWithDietOrder(
               'Without Order',
               1500,
               2500,
            );

            const recipe = await db.recipe.create({
               data: { name: 'Mixed Test Recipe', category: 'Entrees', calories: 400 },
            });

            // Create existing order for first patient
            const today = new Date();
            today.setHours(18, 0, 0, 0);
            await db.trayOrder.create({
               data: {
                  patientId: patientWithOrder.id,
                  scheduledFor: today,
                  mealTime: 'DINNER',
                  recipes: { create: [{ recipeId: recipe.id }] },
               },
            });

            const result = await executePrep('dinner');

            expect(result.patientsProcessed).toBe(2);
            expect(result.ordersCreated).toBe(1);

            // Verify only the second patient got a new order
            const newOrders = await db.trayOrder.findMany({
               where: { patientId: patientWithoutOrder.id, mealTime: 'DINNER' },
            });
            expect(newOrders.length).toBe(1);
         });
      });

      describe('recipe selection', () => {
         it('selects recipes within calorie budget', async () => {
            await db.trayOrderRecipe.deleteMany();
            await db.trayOrder.deleteMany();
            await db.patientDietOrder.deleteMany();
            await db.patient.deleteMany();
            await db.recipe.deleteMany();

            const patient = await createPatientWithDietOrder('Budget Patient', 500, 500);

            // Create recipes of different sizes
            const smallRecipe = await db.recipe.create({
               data: { name: 'Small Recipe', category: 'Sides', calories: 100 },
            });
            await db.recipe.create({
               data: { name: 'Large Recipe', category: 'Entrees', calories: 1000 },
            });

            const result = await executePrep('breakfast');

            expect(result.ordersCreated).toBe(1);

            // Verify the small recipe was selected
            const order = await db.trayOrder.findFirst({
               where: { patientId: patient.id },
               include: { recipes: { include: { recipe: true } } },
            });
            expect(order?.recipes[0].recipe.id).toBe(smallRecipe.id);
         });

         it('creates valid TrayOrderRecipe associations', async () => {
            await db.trayOrderRecipe.deleteMany();
            await db.trayOrder.deleteMany();
            await db.patientDietOrder.deleteMany();
            await db.patient.deleteMany();
            await db.recipe.deleteMany();

            const patient = await createPatientWithDietOrder('Association Patient', 1500, 2500);
            const entree = await db.recipe.create({
               data: { name: 'Association Recipe', category: 'Entrees', calories: 400 },
            });
            const side = await db.recipe.create({
               data: { name: 'Side', category: 'Sides', calories: 100 },
            });

            await executePrep('lunch');

            const order = await db.trayOrder.findFirst({
               where: { patientId: patient.id },
               include: { recipes: true },
            });

            expect(order).not.toBeNull();
            expect(order?.recipes.length).toBe(2);
            expect(order?.recipes[0].recipeId).toBe(entree.id);
            expect(order?.recipes[1].recipeId).toBe(side.id);
         });
      });

      describe('error handling', () => {
         it('continues processing other patients if one fails', async () => {
            await db.trayOrderRecipe.deleteMany();
            await db.trayOrder.deleteMany();
            await db.patientDietOrder.deleteMany();
            await db.patient.deleteMany();

            // Patient without diet order (will fail)
            await db.patient.create({ data: { name: 'No Diet Patient' } });

            // Patient with diet order (should succeed)
            await createPatientWithDietOrder('Has Diet Patient', 1500, 2500);

            await db.recipe.create({
               data: { name: 'Continue Recipe', category: 'Entrees', calories: 400 },
            });

            const result = await executePrep('breakfast');

            expect(result.patientsProcessed).toBe(2);
            expect(result.ordersCreated).toBe(1);
            expect(result.errors.length).toBe(1);
         });

         it('reports errors in response', async () => {
            await db.trayOrderRecipe.deleteMany();
            await db.trayOrder.deleteMany();
            await db.patientDietOrder.deleteMany();
            await db.patient.deleteMany();

            // Patient without diet order
            const patient = await db.patient.create({ data: { name: 'Error Patient' } });

            const result = await executePrep('lunch');

            expect(result.errors.length).toBe(1);
            expect(result.errors[0].patientId).toBe(patient.id);
            expect(result.errors[0].error).toContain('No diet order');
         });

         it('handles patient with no diet order gracefully', async () => {
            await db.trayOrderRecipe.deleteMany();
            await db.trayOrder.deleteMany();
            await db.patientDietOrder.deleteMany();
            await db.patient.deleteMany();

            await db.patient.create({ data: { name: 'No Diet Order Patient' } });

            const result = await executePrep('dinner');

            expect(result.patientsProcessed).toBe(1);
            expect(result.ordersCreated).toBe(0);
            expect(result.errors.length).toBe(1);
         });
      });

      describe('meal time handling', () => {
         it('processes breakfast correctly', async () => {
            await db.trayOrderRecipe.deleteMany();
            await db.trayOrder.deleteMany();
            await db.patientDietOrder.deleteMany();
            await db.patient.deleteMany();

            await createPatientWithDietOrder('Breakfast Patient', 1500, 2500);
            await db.recipe.create({
               data: { name: 'Breakfast Item', category: 'Entrees', calories: 350 },
            });

            const result = await executePrep('breakfast');

            expect(result.ordersCreated).toBe(1);

            const order = await db.trayOrder.findFirst({
               where: { mealTime: 'BREAKFAST' },
            });
            expect(order).not.toBeNull();
            expect(order?.scheduledFor.getHours()).toBe(8);
         });

         it('processes lunch correctly', async () => {
            await db.trayOrderRecipe.deleteMany();
            await db.trayOrder.deleteMany();
            await db.patientDietOrder.deleteMany();
            await db.patient.deleteMany();

            await createPatientWithDietOrder('Lunch Patient', 1500, 2500);
            await db.recipe.create({
               data: { name: 'Lunch Item', category: 'Entrees', calories: 500 },
            });

            const result = await executePrep('lunch');

            expect(result.ordersCreated).toBe(1);

            const order = await db.trayOrder.findFirst({
               where: { mealTime: 'LUNCH' },
            });
            expect(order).not.toBeNull();
            expect(order?.scheduledFor.getHours()).toBe(12);
         });

         it('processes dinner correctly', async () => {
            await db.trayOrderRecipe.deleteMany();
            await db.trayOrder.deleteMany();
            await db.patientDietOrder.deleteMany();
            await db.patient.deleteMany();

            await createPatientWithDietOrder('Dinner Patient', 1500, 2500);
            await db.recipe.create({
               data: { name: 'Dinner Item', category: 'Entrees', calories: 600 },
            });

            const result = await executePrep('dinner');

            expect(result.ordersCreated).toBe(1);

            const order = await db.trayOrder.findFirst({
               where: { mealTime: 'DINNER' },
            });
            expect(order).not.toBeNull();
            expect(order?.scheduledFor.getHours()).toBe(18);
         });
      });
   });
});
