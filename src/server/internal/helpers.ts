import { db } from '../../db';
import { Recipe } from '@prisma/client';
import { DietOrderResponse, MealTimeHour } from './types';

const DESSERT_CALORIE_APPROXIMATION = 120;

// APPROVED - some comments

// TODO: Maybe replace this with date-fns..
/**
 * Returns the start of day (12:01 AM) for a given date
 * APPROVED
 */
export const getStartOfDay = (date: Date): Date => {
    const start = new Date(date);
    start.setHours(0, 1, 0, 0); // 12:01 AM
    return start;
};

// TODO: Maybe replace this with date-fns..
/**
 * Returns the end of day (11:59:59 PM) for a given date
 * APPROVED
 */
export const getEndOfDay = (date: Date): Date => {
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return end;
};

// TODO: Maybe replace this with date-fns...
// TODO: Should this be a rolling week or a fixed window...
/**
 * Returns date range for +/- 1 week from base date
 */
export const getDateRangeForWeek = (baseDate: Date): { start: Date; end: Date } => {
    const start = new Date(baseDate);
    start.setDate(start.getDate() - 7); // for fixed: start.setDate(0);
    start.setHours(0, 0, 0, 0);

    const end = new Date(baseDate);
    end.setDate(end.getDate() + 7); // for fixed: start.setDate(6);
    end.setHours(23, 59, 59, 999);

    return { start, end };
};

/**
 * Calculates the sum of all calories consumed by a patient for a given date.
 * Queries TrayOrders scheduled between 12:01AM and the current time (or end of day if date is in past),
 * joins with Recipe via TrayOrderRecipe, and sums the calories.
 *
 * @param patientId - The UUID of the patient
 * @param date - The date to calculate calories for
 * @returns The total calories consumed
 */
export const calculateCaloriesConsumed = async (patientId: string, date: Date): Promise<number> => {
    const startOfDay = getStartOfDay(date);
    const now = new Date();

    // TODO: ~Nazario, validate this statement...~ validated
    // Use the earlier of: current time or end of day
    // This ensures we only count meals that have been "served" (scheduled time has passed)
    const endTime = now < getEndOfDay(date) ? now : getEndOfDay(date);

    // If start of day is after end time, return 0 (date is in the future)
    if (startOfDay > endTime) {
        return 0;
    }

    const trayOrders = await db.trayOrder.findMany({
        where: {
            patientId,
            scheduledFor: {
                gte: startOfDay,
                lte: endTime,
            },
        },
        // TODO: ~what does this do?~ joins the recipie table
        include: {
            recipes: {
                include: {
                    recipe: true,
                },
            },
        },
    });

    let totalCalories = 0;
    for (const trayOrder of trayOrders) {
        for (const trayOrderRecipe of trayOrder.recipes) {
            totalCalories += trayOrderRecipe.recipe.calories;
        }
    }

    return totalCalories;
};

/**
 * Calculates the calories that a Patient has available for a given meal.
 * Takes into consideration how many calories they have consumed that day.
 *
 * Does make a few assumptions.
 * 1. Takes the average max and min calories as defined by the diet order and divides it by 3 (breakfast, lunch, dinner).
 * 2. Barrows calories from breakfast and lunch in order to have calories for dinner.
 * @param mealTime
 * @param dietOrder
 */
export const calcAdjustedMealCalorieTarget = (
  mealTime: MealTimeHour,
  dietOrder: DietOrderResponse,
): number => {

    // Calculate roughly a third of the average calories that they need to have minus some space for dessert.
    // This represents the target caloric value of the meal being assembled.
    const _mealCalorieTargetBase = Math.floor(((dietOrder.maximum_calories + dietOrder.minimum_calories)/2)/3);
    const targetDinner = _mealCalorieTargetBase + DESSERT_CALORIE_APPROXIMATION;
    const targetBreakfastLunch = _mealCalorieTargetBase - (DESSERT_CALORIE_APPROXIMATION/2);

    // This calculates the number of calories we must adjust based on previous eating (like snacks)
    let adjustedTarget: number;
    if (mealTime === 'dinner') {
        // subtract from the targetDinner any unexpected over or under consumption aside from the expected 2 meals, breakfast and lunch to get dinners target true target.
        adjustedTarget = targetDinner - (dietOrder.calories_consumed - (targetBreakfastLunch * 2));
    } else if (mealTime === 'lunch') {
        // subtract from the targetBreakfastLunch any unexpected over or under consumption aside from the expected breakfast and lunch to get dinners target true target.
        adjustedTarget = targetBreakfastLunch - (dietOrder.calories_consumed - targetBreakfastLunch);
    } else {
        // if Patient had a snack before breakfast, it would show here but most of the time calories_consumed in the morning will be 0.
        adjustedTarget = targetBreakfastLunch - dietOrder.calories_consumed;
    }

    return adjustedTarget;
}

