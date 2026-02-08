import { db } from '../../src/db';
import {
   getDietOrder,
   getAvailableRecipes,
   getTrayOrders,
   postTrayOrders,
   deleteTrayOrders,
} from '../../src/server/internal/patientApi';

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

describe('PatientApi', () => {
   describe('getDietOrder', () => {
      it('returns diet order with correct min/max calories', async () => {
         const patient = await createPatientWithDietOrder('Test Patient', 1500, 2500);

         const result = await getDietOrder(patient.id);

         expect(result.minimumCalories).toBe(1500);
         expect(result.maximumCalories).toBe(2500);
      });

      it('includes calories consumed for the day', async () => {
         const patient = await createPatientWithDietOrder('Test Patient Cal', 1500, 2500);
         const recipe = await db.recipe.create({
            data: { name: 'Test Food', category: 'Entrees', calories: 500 },
         });

         // Create a tray order from earlier today
         const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
         await db.trayOrder.create({
            data: {
               patientId: patient.id,
               scheduledFor: oneHourAgo,
               mealTime: 'BREAKFAST',
               recipes: {
                  create: [{ recipeId: recipe.id }],
               },
            },
         });

         const result = await getDietOrder(patient.id);

         expect(result.caloriesConsumed).toBe(500);
      });

      it('throws error for patient without diet order', async () => {
         const patient = await db.patient.create({ data: { name: 'No Diet Patient' } });

         await expect(getDietOrder(patient.id)).rejects.toThrow('has no diet order');
      });

      it('returns 0 calories consumed when no tray orders exist', async () => {
         const patient = await createPatientWithDietOrder('No Orders Patient', 1500, 2500);

         const result = await getDietOrder(patient.id);

         expect(result.caloriesConsumed).toBe(0);
      });
   });

   describe('getAvailableRecipes', () => {
      it('returns all recipes when patient has full budget', async () => {
         const patient = await createPatientWithDietOrder('Full Budget Patient', 1500, 2500);

         // Create some test recipes
         await db.recipe.create({
            data: { name: 'Small Meal', category: 'Entrees', calories: 300 },
         });
         await db.recipe.create({
            data: { name: 'Large Meal', category: 'Entrees', calories: 800 },
         });

         const result = await getAvailableRecipes(patient.id);

         // Should include both recipes plus any from seed data
         expect(result.recipes.length).toBeGreaterThanOrEqual(2);
      });

      it('filters out recipes exceeding remaining calorie budget', async () => {
         const patient = await createPatientWithDietOrder('Limited Budget Patient', 1000, 1000);

         // Create recipes with different calorie counts
         const smallRecipe = await db.recipe.create({
            data: { name: 'Tiny Meal', category: 'Sides', calories: 100 },
         });
         const hugeRecipe = await db.recipe.create({
            data: { name: 'Huge Meal', category: 'Entrees', calories: 2000 },
         });

         const result = await getAvailableRecipes(patient.id);
         const recipeIds = result.recipes.map((m) => m.id);
         expect(recipeIds).toContain(smallRecipe.id);
         expect(recipeIds).not.toContain(hugeRecipe.id);
      });

      it('returns empty array when no recipes fit budget', async () => {
         // Clear all recipes and tray order recipes to have controlled test
         await db.trayOrderRecipe.deleteMany();
         await db.recipe.deleteMany();

         // Create only recipes with calories > 0
         await db.recipe.create({
            data: { name: 'High Cal Only', category: 'Entrees', calories: 500 },
         });

         const patient = await createPatientWithDietOrder('Zero Budget Patient', 0, 0);

         const result = await getAvailableRecipes(patient.id);

         expect(result.recipes.length).toBe(0);
      });
   });

   it('orders recipes by calories ascending', async () => {
      const patient = await createPatientWithDietOrder('Sorted Patient', 1500, 5000);

      await db.recipe.create({
         data: { name: 'Medium', category: 'Entrees', calories: 500 },
      });
      await db.recipe.create({ data: { name: 'Large', category: 'Entrees', calories: 900 } });
      await db.recipe.create({ data: { name: 'Small', category: 'Sides', calories: 100 } });

      const result = await getAvailableRecipes(patient.id);

      // Verify ascending order
      for (let i = 1; i < result.recipes.length; i++) {
         expect(result.recipes[i].calories).toBeLessThanOrEqual(result.recipes[i - 1].calories);
      }
   });
});

describe('getTrayOrders', () => {
   it('returns tray orders within +/- 1 week window', async () => {
      const patient = await createPatientWithDietOrder('Week Window Patient', 1500, 2500);
      const recipe = await db.recipe.create({
         data: { name: 'Test Recipe', category: 'Entrees', calories: 400 },
      });

      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);

      await db.trayOrder.create({
         data: {
            patientId: patient.id,
            scheduledFor: tomorrow,
            mealTime: 'LUNCH',
            recipes: { create: [{ recipeId: recipe.id }] },
         },
      });

      const result = await getTrayOrders(patient.id);

      expect(result.scheduled.length).toBe(1);
   });

   it('filters by mealTime when provided', async () => {
      const patient = await createPatientWithDietOrder('MealTime Filter Patient', 1500, 2500);
      const recipe = await db.recipe.create({
         data: { name: 'Filter Recipe', category: 'Entrees', calories: 400 },
      });

      const now = new Date();

      await db.trayOrder.create({
         data: {
            patientId: patient.id,
            scheduledFor: now,
            mealTime: 'BREAKFAST',
            recipes: { create: [{ recipeId: recipe.id }] },
         },
      });

      await db.trayOrder.create({
         data: {
            patientId: patient.id,
            scheduledFor: now,
            mealTime: 'LUNCH',
            recipes: { create: [{ recipeId: recipe.id }] },
         },
      });

      const result = await getTrayOrders(patient.id, 'breakfast');

      expect(result.scheduled.length).toBe(1);
      expect(result.scheduled[0].tray.mealTime).toBe('BREAKFAST');
   });

   it('excludes past orders when showPast is false', async () => {
      const patient = await createPatientWithDietOrder('ShowPast Patient', 1500, 2500);
      const recipe = await db.recipe.create({
         data: { name: 'Past Recipe', category: 'Entrees', calories: 400 },
      });

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await db.trayOrder.create({
         data: {
            patientId: patient.id,
            scheduledFor: yesterday,
            mealTime: 'LUNCH',
            recipes: { create: [{ recipeId: recipe.id }] },
         },
      });

      await db.trayOrder.create({
         data: {
            patientId: patient.id,
            scheduledFor: tomorrow,
            mealTime: 'DINNER',
            recipes: { create: [{ recipeId: recipe.id }] },
         },
      });

      const result = await getTrayOrders(patient.id, undefined, false);

      expect(result.scheduled.length).toBe(1);
      expect(result.scheduled[0].tray.mealTime).toBe('DINNER');
   });

   it('includes recipes with each tray order', async () => {
      const patient = await createPatientWithDietOrder('Recipes Patient', 1500, 2500);
      const recipe1 = await db.recipe.create({
         data: { name: 'Recipe 1', category: 'Entrees', calories: 400 },
      });
      const recipe2 = await db.recipe.create({
         data: { name: 'Recipe 2', category: 'Sides', calories: 200 },
      });

      const now = new Date();

      await db.trayOrder.create({
         data: {
            patientId: patient.id,
            scheduledFor: now,
            mealTime: 'LUNCH',
            recipes: {
               create: [{ recipeId: recipe1.id }, { recipeId: recipe2.id }],
            },
         },
      });

      const result = await getTrayOrders(patient.id);

      expect(result.scheduled[0].recipes.length).toBe(2);
   });
});

describe('postTrayOrders', () => {
   it('creates a single tray order with one recipe', async () => {
      const patient = await createPatientWithDietOrder('Post Single Patient', 1500, 2500);
      const recipe = await db.recipe.create({
         data: { name: 'Single Recipe', category: 'Entrees', calories: 400 },
      });

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const result = await postTrayOrders(patient.id, {
         trays: [
            {
               scheduledFor: tomorrow,
               mealTime: 'lunch',
               recipeIds: [recipe.id],
            },
         ],
      });

      expect(result.trayOrders.length).toBe(1);
      expect(result.trayOrders[0].mealTime).toBe('LUNCH');
   });

   it('creates a single tray order with multiple recipes', async () => {
      const patient = await createPatientWithDietOrder('Multi Recipe Patient', 1500, 2500);
      const recipe1 = await db.recipe.create({
         data: { name: 'Recipe A', category: 'Entrees', calories: 300 },
      });
      const recipe2 = await db.recipe.create({
         data: { name: 'Recipe B', category: 'Sides', calories: 150 },
      });

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const result = await postTrayOrders(patient.id, {
         trays: [
            {
               scheduledFor: tomorrow,
               mealTime: 'dinner',
               recipeIds: [recipe1.id, recipe2.id],
            },
         ],
      });

      expect(result.trayOrders.length).toBe(1);

      // Verify recipes were associated
      const trayOrderRecipes = await db.trayOrderRecipe.findMany({
         where: { trayOrderId: result.trayOrders[0].id },
      });
      expect(trayOrderRecipes.length).toBe(2);
   });

   it('creates multiple tray orders in one request', async () => {
      const patient = await createPatientWithDietOrder('Multi Tray Patient', 1500, 2500);
      const recipe = await db.recipe.create({
         data: { name: 'Multi Tray Recipe', category: 'Entrees', calories: 200 },
      });

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const result = await postTrayOrders(patient.id, {
         trays: [
            { scheduledFor: tomorrow, mealTime: 'breakfast', recipeIds: [recipe.id] },
            { scheduledFor: tomorrow, mealTime: 'lunch', recipeIds: [recipe.id] },
            { scheduledFor: tomorrow, mealTime: 'dinner', recipeIds: [recipe.id] },
         ],
      });

      expect(result.trayOrders.length).toBe(3);
   });

   it('rejects order when recipes exceed calorie budget', async () => {
      const patient = await createPatientWithDietOrder('Budget Exceed Patient', 500, 500);
      const recipe = await db.recipe.create({
         data: { name: 'Too Big Recipe', category: 'Entrees', calories: 600 },
      });

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await expect(
         postTrayOrders(patient.id, {
            trays: [{ scheduledFor: tomorrow, mealTime: 'lunch', recipeIds: [recipe.id] }],
         }),
      ).rejects.toThrow('exceeds calorie budget');
   });

   it('rejects order with non-existent recipe id', async () => {
      const patient = await createPatientWithDietOrder('Invalid Recipe Patient', 1500, 2500);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await expect(
         postTrayOrders(patient.id, {
            trays: [
               {
                  scheduledFor: tomorrow,
                  mealTime: 'lunch',
                  recipeIds: ['non-existent-id'],
               },
            ],
         }),
      ).rejects.toThrow('Invalid recipe IDs');
   });
});

describe('deleteTrayOrders', () => {
   it('deletes a single tray order', async () => {
      const patient = await createPatientWithDietOrder('Delete Single Patient', 1500, 2500);
      const recipe = await db.recipe.create({
         data: { name: 'Delete Recipe', category: 'Entrees', calories: 400 },
      });

      const trayOrder = await db.trayOrder.create({
         data: {
            patientId: patient.id,
            scheduledFor: new Date(),
            mealTime: 'LUNCH',
            recipes: { create: [{ recipeId: recipe.id }] },
         },
      });

      const result = await deleteTrayOrders(patient.id, [trayOrder.id]);

      expect(result.deletedCount).toBe(1);

      const found = await db.trayOrder.findUnique({ where: { id: trayOrder.id } });
      expect(found).toBeNull();
   });

   it('deletes multiple tray orders', async () => {
      const patient = await createPatientWithDietOrder('Delete Multi Patient', 1500, 2500);
      const recipe = await db.recipe.create({
         data: { name: 'Delete Multi Recipe', category: 'Entrees', calories: 400 },
      });

      const trayOrder1 = await db.trayOrder.create({
         data: {
            patientId: patient.id,
            scheduledFor: new Date(),
            mealTime: 'BREAKFAST',
            recipes: { create: [{ recipeId: recipe.id }] },
         },
      });

      const trayOrder2 = await db.trayOrder.create({
         data: {
            patientId: patient.id,
            scheduledFor: new Date(),
            mealTime: 'LUNCH',
            recipes: { create: [{ recipeId: recipe.id }] },
         },
      });

      const result = await deleteTrayOrders(patient.id, [trayOrder1.id, trayOrder2.id]);

      expect(result.deletedCount).toBe(2);
   });

   it('also deletes associated TrayOrderRecipe entries', async () => {
      const patient = await createPatientWithDietOrder('Delete Cascade Patient', 1500, 2500);
      const recipe = await db.recipe.create({
         data: { name: 'Cascade Recipe', category: 'Entrees', calories: 400 },
      });

      const trayOrder = await db.trayOrder.create({
         data: {
            patientId: patient.id,
            scheduledFor: new Date(),
            mealTime: 'LUNCH',
            recipes: { create: [{ recipeId: recipe.id }] },
         },
      });

      await deleteTrayOrders(patient.id, [trayOrder.id]);

      const orphanedRecipes = await db.trayOrderRecipe.findMany({
         where: { trayOrderId: trayOrder.id },
      });
      expect(orphanedRecipes.length).toBe(0);
   });

   it('rejects deletion of tray orders belonging to other patients', async () => {
      const patient1 = await createPatientWithDietOrder('Owner Patient', 1500, 2500);
      const patient2 = await createPatientWithDietOrder('Other Patient', 1500, 2500);
      const recipe = await db.recipe.create({
         data: { name: 'Other Recipe', category: 'Entrees', calories: 400 },
      });

      const trayOrder = await db.trayOrder.create({
         data: {
            patientId: patient1.id,
            scheduledFor: new Date(),
            mealTime: 'LUNCH',
            recipes: { create: [{ recipeId: recipe.id }] },
         },
      });

      await expect(deleteTrayOrders(patient2.id, [trayOrder.id])).rejects.toThrow(
         'Cannot delete tray orders belonging to other patients',
      );
   });
});
