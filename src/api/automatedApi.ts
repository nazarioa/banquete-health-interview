import { db } from '../db';
import { getStartOfDay, getEndOfDay } from './helpers';
import { getDietOrder, getAvailableMeals as patientGetAvailableMeals } from './patientApi';
import {
    DietOrderResponse,
    MealsResponse,
    ExecutePrepResponse,
    MealTimeInput,
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
 * Same as patientApi.getAvailableMeals but with explicit patient_id parameter.
 */
// TODO: I think this is not actually getting meals by calorie budget
export const getAvailableMeals = async (
    patientId: string,
    mealTime: MealTimeInput
): Promise<MealsResponse> => {
    return patientGetAvailableMeals(patientId, mealTime);
};

/**
 * Checks if a patient has a tray order for a specific day and meal time.
 */
const hasExistingOrder = async (
    patientId: string,
    date: Date,
    mealTime: MealTimeInput
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
const getServeTime = (date: Date, mealTime: 'breakfast' | 'lunch' | 'dinner'): Date => {
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
export const executePrep = async (
    mealTime: 'breakfast' | 'lunch' | 'dinner'
): Promise<ExecutePrepResponse> => {
    // TODO: this is almost correct... move this to triggerSmartOrderSystem
    const today = new Date();
    const serveTime = getServeTime(today, mealTime);
    // TODO: END

    const result: ExecutePrepResponse = {
        patientsProcessed: 0,
        ordersCreated: 0,
        errors: [],
    };

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
                // TODO: Maybe we should have a default meal?
                // Patient has no diet order, skip with warning
                result.errors.push({
                    patientId: patient.id,
                    error: `No diet order found`,
                });
                continue;
            }

            // Get available meals within budget
            const availableMeals = await getAvailableMeals(patient.id, mealTime);

            if (availableMeals.meals.length === 0) {
                result.errors.push({
                    patientId: patient.id,
                    error: `No recipes available within calorie budget`,
                });
                continue;
            }

            // Select a single recipe that fits (first one, sorted by calories ascending)
            const selectedRecipe = availableMeals.meals[0];

            // Create the tray order
            await db.trayOrder.create({
                data: {
                    patientId: patient.id,
                    scheduledFor: serveTime,
                    mealTime: toMealTimeEnum(mealTime),
                    recipes: {
                        create: [{ recipeId: selectedRecipe.id }],
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

    return result;
};
