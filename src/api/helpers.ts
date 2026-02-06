import { db } from '../db';

/**
 * Returns the start of day (12:01 AM) for a given date
 */
export const getStartOfDay = (date: Date): Date => {
    const start = new Date(date);
    start.setHours(0, 1, 0, 0); // 12:01 AM
    return start;
};

/**
 * Returns the end of day (11:59:59 PM) for a given date
 */
export const getEndOfDay = (date: Date): Date => {
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return end;
};

/**
 * Returns date range for +/- 1 week from base date
 */
export const getDateRangeForWeek = (baseDate: Date): { start: Date; end: Date } => {
    const start = new Date(baseDate);
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);

    const end = new Date(baseDate);
    end.setDate(end.getDate() + 7);
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
