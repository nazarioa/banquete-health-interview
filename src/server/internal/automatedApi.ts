import { db } from '../../db';
import { calcAdjustedMealCalorieTarget, getEndOfDay, getStartOfDay, mealBuilder } from './helpers';
import { getAvailableRecipes as getPatientAvailableRecipes, getDietOrder } from './patientApi';
import {
   DietOrderResponse,
   ExecutePrepResponse,
   ItemCategory,
   MealTimeHour,
   MealTimeInput,
   PrepExecutionResponse,
   RecipeResponse,
   toMealTimeEnum,
} from './types';

/**
 * Returns the daily caloric limitations plus the remaining allotment for a given patient.
 * Same as patientApi.getDietOrder but with explicit patient_id parameter.
 * Used by automated systems.
 */
export const getAdminDietOrder = async (patientId: string): Promise<DietOrderResponse> => {
   return getDietOrder(patientId);
};

/**
 * Returns recipes that fit within the patient's remaining calorie budget.
 * Same as patientApi.getAvailableRecipes but with explicit patient_id parameter.
 */
// TODO: I think this is not actually getting meals by calorie budget
export const getAvailableRecipes = async (
   patientId: string,
   category?: ItemCategory,
): Promise<RecipeResponse> => {
   return getPatientAvailableRecipes(patientId, category);
};

/**
 * Checks if a patient has a tray order for a specific day and meal time.
 */
const hasExistingOrder = async (
   patientId: string,
   date: Date,
   mealTime: MealTimeInput,
): Promise<boolean> => {
   const startOfDay = getStartOfDay(date);
   const endOfDay = getEndOfDay(date);

   const existingOrder = await db.trayOrder.findFirst({
      where: {
         patientId,
         mealTime: toMealTimeEnum(mealTime),
         scheduledFor: {
            gte: startOfDay,
            lte: endOfDay,
         },
      },
   });

   return existingOrder !== null;
};

/**
 * Gets the scheduled serve time for a given meal time.
 */
const getServeTime = (date: Date, mealTime: MealTimeHour): Date => {
   const serveTime = new Date(date);

   switch (mealTime) {
      case 'breakfast':
         serveTime.setHours(8, 0, 0, 0);
         break;
      case 'lunch':
         serveTime.setHours(12, 0, 0, 0);
         break;
      case 'dinner':
         serveTime.setHours(18, 0, 0, 0);
         break;
   }

   return serveTime;
};

/**
 * Checks if a prep execution has already been processed today for the given meal time.
 */
export const hasProcessedMealToday = async (mealTime: MealTimeHour): Promise<boolean> => {
   const today = new Date();
   const startOfDay = getStartOfDay(today);
   const endOfDay = getEndOfDay(today);

   const existingExecution = await db.prepExecution.findFirst({
      where: {
         mealTime: toMealTimeEnum(mealTime),
         executedAt: {
            gte: startOfDay,
            lte: endOfDay,
         },
      },
   });

   return existingExecution !== null;
};

/**
 * Cron job function that creates tray orders for patients without orders.
 * Called 4 hours before each meal serve time:
 * - breakfast: 4:00 AM (serves 8:00 AM)
 * - lunch: 8:00 AM (serves 12:00 PM)
 * - dinner: 2:00 PM (serves 6:00 PM)
 *
 * For each patient without a TrayOrder for today/mealTime:
 * - Get remaining calorie budget
 * - Select a single recipe that fits
 * - Create TrayOrder + TrayOrderRecipe
 *
 * @param mealTime - The meal time to prepare orders for (snack not supported)
 * @returns Summary of actions taken
 */
export const executePrep = async (mealTime: MealTimeHour): Promise<ExecutePrepResponse> => {
   const today = new Date();
   const serveTime = getServeTime(today, mealTime);
   const result: ExecutePrepResponse = {
      patientsProcessed: 0,
      ordersCreated: 0,
      errors: [],
   };

   const hasProcessedToday = await hasProcessedMealToday(mealTime);
   if (hasProcessedToday) {
      console.log(`Already ran ordering for ${mealTime} today. No action taken.`);
      return {
         patientsProcessed: 0,
         ordersCreated: 0,
         errors: [],
      };
   }

   // TODO: set systemwide status that "the meals are being prepped, and orders cannot be changed".

   // Get all patients
   const patients = await db.patient.findMany();

   for (const patient of patients) {
      result.patientsProcessed++;

      try {
         // Check if patient already has an order for this meal today
         const hasOrder = await hasExistingOrder(patient.id, today, mealTime);
         if (hasOrder) {
            continue; // Skip this patient
         }

         // Get patient's diet order
         let dietOrder: DietOrderResponse;
         try {
            dietOrder = await getAdminDietOrder(patient.id);
         } catch (error) {
            // TODO: Maybe we should have a default meal for a given DietOrder?
            // Patient has no diet order, skip with warning
            result.errors.push({
               patientId: patient.id,
               error: `No diet order found`,
            });
            continue;
         }

         // Get available meals within budget
         const { recipes: availableEntrees } = await getAvailableRecipes(patient.id, 'Entrees');
         const { recipes: availableBeverages } = await getAvailableRecipes(patient.id, 'Beverages');
         const { recipes: availableSides } = await getAvailableRecipes(patient.id, 'Sides');
         const { recipes: availableDesserts } = await getAvailableRecipes(patient.id, 'Desserts');

         const mealCalorieTarget = calcAdjustedMealCalorieTarget(mealTime, dietOrder);

         const meal = mealBuilder(mealTime, mealCalorieTarget, {
            entrees: availableEntrees,
            beverages: availableBeverages,
            sides: availableSides,
            desserts: availableDesserts,
         });

         if (!meal.length) {
            result.errors.push({
               patientId: patient.id,
               error: `Could not build a meal within calorie budget`,
            });
            continue;
         }

         // Create the tray order
         await db.trayOrder.create({
            data: {
               patientId: patient.id,
               scheduledFor: serveTime,
               mealTime: toMealTimeEnum(mealTime),
               recipes: {
                  create: meal.map((r) => ({ recipeId: r.id })),
               },
            },
         });

         result.ordersCreated++;
      } catch (error) {
         result.errors.push({
            patientId: patient.id,
            error: error instanceof Error ? error.message : 'Unknown error',
         });
      }
   }

   // Store execution results in database
   await db.prepExecution.create({
      data: {
         mealTime: toMealTimeEnum(mealTime),
         patientsProcessed: result.patientsProcessed,
         ordersCreated: result.ordersCreated,
         errors: result.errors,
      },
   });

   return result;
};

/**
 * Returns the history of prep executions.
 * Optionally filter by meal time.
 */
export const getPrepExecutions = async (
   mealTime?: MealTimeHour,
   limit: number = 50,
): Promise<PrepExecutionResponse[]> => {
   const executions = await db.prepExecution.findMany({
      where: mealTime ? { mealTime: toMealTimeEnum(mealTime) } : undefined,
      orderBy: { executedAt: 'desc' },
      take: limit,
   });

   return executions.map((exec) => ({
      id: exec.id,
      executedAt: exec.executedAt,
      mealTime: exec.mealTime.toLowerCase() as MealTimeInput,
      patientsProcessed: exec.patientsProcessed,
      ordersCreated: exec.ordersCreated,
      errors: exec.errors as Array<{ patientId: string; error: string }>,
   }));
};
