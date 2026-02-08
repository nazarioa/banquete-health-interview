import { db } from '../../db';
import { calculateCaloriesConsumed, getDateRangeForWeek } from './helpers';
import {
    DeleteTrayOrdersResponse,
    DietOrderResponse,
    ItemCategory,
    RecipeResponse,
    MealTimeInput,
    ScheduledTrayResponse,
    toMealTimeEnum,
    TrayOrderRequest,
    TrayOrderResponse,
} from './types';

/**
 * Returns the daily caloric limitations plus the remaining allotment.
 * @param patientId - The UUID of the patient
 * @returns Diet order with min/max calories and calories consumed today
 * @throws Error if patient has no diet order
 */
export const getDietOrder = async (patientId: string): Promise<DietOrderResponse> => {
    const patientDietOrder = await db.patientDietOrder.findFirst({
        where: { patientId },
        include: { dietOrder: true },
    });

    if (!patientDietOrder) {
        throw new Error(`Patient ${patientId} has no diet order`);
    }

    const caloriesConsumed = await calculateCaloriesConsumed(patientId, new Date());

    return {
        minimum_calories: patientDietOrder.dietOrder.minimumCalories ?? 0,
        // TODO: Is this a resonable upper bound?
        maximum_calories: patientDietOrder.dietOrder.maximumCalories ?? Infinity,
        calories_consumed: caloriesConsumed,
    };
};

/**
 * Returns recipes that fit within the patient's remaining calorie budget.
 * @param patientId - The UUID of the patient
 * @param category - optional. the type of food (beverages, sides, entrees, desserts)
 * @returns List of available recipes
 */
export const getAvailableRecipes = async (
    patientId: string,
    category?: ItemCategory,
): Promise<RecipeResponse> => {
    const dietOrder = await getDietOrder(patientId);
    const remainingBudget = dietOrder.maximum_calories - dietOrder.calories_consumed;

    const recipes = await db.recipe.findMany({
        where: {
            calories: {
                lte: remainingBudget,
            },
            category: category ? category : undefined, // filter by category if included.
        },
        orderBy: {
            calories: 'desc',
        },
    });

    return { recipes };
};

/**
 * Returns scheduled tray orders for the patient within +/- 1 week.
 * @param patientId - The UUID of the patient
 * @param mealTime - Optional filter by meal time
 * @param showPast - Whether to include past orders (default: true)
 * @returns Scheduled tray orders with their recipes
 */
export const getTrayOrders = async (
    patientId: string,
    mealTime?: MealTimeInput,
    showPast: boolean = true
): Promise<ScheduledTrayResponse> => {
    const now = new Date();
    const { start, end } = getDateRangeForWeek(now);

    const whereClause: any = {
        patientId,
        scheduledFor: {
            gte: showPast ? start : now,
            lte: end,
        },
    };

    if (mealTime) {
        whereClause.mealTime = toMealTimeEnum(mealTime);
    }

    const trayOrders = await db.trayOrder.findMany({
        where: whereClause,
        include: {
            recipes: {
                include: {
                    recipe: true,
                },
            },
        },
        orderBy: {
            scheduledFor: 'asc',
        },
    });

    return {
        scheduled: trayOrders.map((trayOrder) => ({
            tray: trayOrder,
            recipes: trayOrder.recipes.map((tor) => tor.recipe),
        })),
    };
};

/**
 * Creates one or more tray orders for the patient.
 * @param patientId - The UUID of the patient
 * @param request - The tray order request with trays to create
 * @returns Created tray orders
 * @throws Error if recipe IDs are invalid or calorie budget exceeded
 */
export const postTrayOrders = async (
    patientId: string,
    request: TrayOrderRequest
): Promise<TrayOrderResponse> => {
    // Validate all recipe IDs exist
    const allRecipeIds = request.trays.flatMap((t) => t.recipe_ids);
    const uniqueRecipeIds = [...new Set(allRecipeIds)];
    const recipes = await db.recipe.findMany({
        where: { id: { in: uniqueRecipeIds } },
    });

    if (recipes.length !== uniqueRecipeIds.length) {
        const foundIds = new Set(recipes.map((r) => r.id));
        const missingIds = uniqueRecipeIds.filter((id) => !foundIds.has(id));
        throw new Error(`Invalid recipe IDs: ${missingIds.join(', ')}`);
    }

    // Create a map for quick calorie lookup
    const recipeCalorieMap = new Map(recipes.map((r) => [r.id, r.calories]));

    // Get current diet order to check budget
    const dietOrder = await getDietOrder(patientId);
    const remainingBudget = dietOrder.maximum_calories - dietOrder.calories_consumed;

    // Calculate total calories for all new orders
    let totalNewCalories = 0;
    for (const tray of request.trays) {
        for (const recipeId of tray.recipe_ids) {
            totalNewCalories += recipeCalorieMap.get(recipeId) ?? 0;
        }
    }

    if (totalNewCalories > remainingBudget) {
        throw new Error(
            `Order exceeds calorie budget. Remaining: ${remainingBudget}, Requested: ${totalNewCalories}`
        );
    }

    // Create tray orders in a transaction
    const createdOrders = await db.$transaction(async (tx) => {
        const orders = [];

        for (const tray of request.trays) {
            const trayOrder = await tx.trayOrder.create({
                data: {
                    patientId,
                    scheduledFor: new Date(tray.scheduled_for),
                    mealTime: toMealTimeEnum(tray.mealTime),
                    recipes: {
                        create: tray.recipe_ids.map((recipeId) => ({
                            recipeId,
                        })),
                    },
                },
            });
            orders.push(trayOrder);
        }

        return orders;
    });

    return { trayOrders: createdOrders };
};

/**
 * Deletes specified tray orders belonging to the patient.
 * @param patientId - The UUID of the patient
 * @param trayOrderIds - Array of tray order IDs to delete
 * @returns Count of deleted orders
 * @throws Error if trying to delete orders belonging to other patients
 */
export const deleteTrayOrders = async (
    patientId: string,
    trayOrderIds: string[]
): Promise<DeleteTrayOrdersResponse> => {
    // Verify all tray orders belong to the patient
    const trayOrders = await db.trayOrder.findMany({
        where: { id: { in: trayOrderIds } },
    });

    const unauthorizedOrders = trayOrders.filter((to) => to.patientId !== patientId);
    if (unauthorizedOrders.length > 0) {
        throw new Error('Cannot delete tray orders belonging to other patients');
    }

    // Delete in transaction: first TrayOrderRecipe, then TrayOrder
    const result = await db.$transaction(async (tx) => {
        // Delete associated recipes first
        await tx.trayOrderRecipe.deleteMany({
            where: { trayOrderId: { in: trayOrderIds } },
        });

        // Delete tray orders
        const deleted = await tx.trayOrder.deleteMany({
            where: {
                id: { in: trayOrderIds },
                patientId, // Extra safety check
            },
        });

        return deleted.count;
    });

    return { deletedCount: result };
};
