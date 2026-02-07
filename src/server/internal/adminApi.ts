import { Patient, Recipe, DietOrder, PatientDietOrder, TrayOrder } from '@prisma/client';
import { db } from '../../db';
import {
    CreatePatientInput,
    UpdatePatientInput,
    CreateRecipeInput,
    UpdateRecipeInput,
    CreateDietOrderInput,
    UpdateDietOrderInput,
    CreatePatientDietOrderInput,
    CreateTrayOrderInput,
    UpdateTrayOrderInput,
    toMealTimeEnum,
} from './types';

// ============================================================================
// Patient CRUD
// ============================================================================

export const createPatient = async (input: CreatePatientInput): Promise<Patient> => {
    return db.patient.create({
        data: { name: input.name },
    });
};

export const getPatient = async (id: string): Promise<Patient | null> => {
    return db.patient.findUnique({
        where: { id },
    });
};

export const getAllPatients = async (): Promise<Patient[]> => {
    return db.patient.findMany();
};

export const updatePatient = async (input: UpdatePatientInput): Promise<Patient> => {
    return db.patient.update({
        where: { id: input.id },
        data: { name: input.name },
    });
};

export const deletePatient = async (id: string): Promise<void> => {
    // Delete in order to respect foreign key constraints
    // TODO: I think this can be done better using cascade delet rules in the database...
    await db.$transaction(async (tx) => {
        // First, delete tray order recipes for this patient's orders
        const trayOrders = await tx.trayOrder.findMany({
            where: { patientId: id },
            select: { id: true },
        });
        const trayOrderIds = trayOrders.map((to) => to.id);

        await tx.trayOrderRecipe.deleteMany({
            where: { trayOrderId: { in: trayOrderIds } },
        });

        // Delete tray orders
        await tx.trayOrder.deleteMany({
            where: { patientId: id },
        });

        // Delete patient diet orders
        await tx.patientDietOrder.deleteMany({
            where: { patientId: id },
        });

        // Finally delete the patient
        await tx.patient.delete({
            where: { id },
        });
    });
};

// ============================================================================
// Recipe CRUD
// ============================================================================

export const createRecipe = async (input: CreateRecipeInput): Promise<Recipe> => {
    return db.recipe.create({
        data: {
            name: input.name,
            category: input.category,
            calories: input.calories,
        },
    });
};

export const getRecipe = async (id: string): Promise<Recipe | null> => {
    return db.recipe.findUnique({
        where: { id },
    });
};

export const getAllRecipes = async (): Promise<Recipe[]> => {
    return db.recipe.findMany();
};

export const updateRecipe = async (input: UpdateRecipeInput): Promise<Recipe> => {
    return db.recipe.update({
        where: { id: input.id },
        data: {
            name: input.name,
            category: input.category,
            calories: input.calories,
        },
    });
};

export const deleteRecipe = async (id: string): Promise<void> => {
    await db.$transaction(async (tx) => {
        // Delete associated tray order recipes first
        await tx.trayOrderRecipe.deleteMany({
            where: { recipeId: id },
        });

        // Delete the recipe
        await tx.recipe.delete({
            where: { id },
        });
    });
};

// ============================================================================
// DietOrder CRUD
// ============================================================================

export const createDietOrder = async (input: CreateDietOrderInput): Promise<DietOrder> => {
    return db.dietOrder.create({
        data: {
            name: input.name,
            minimumCalories: input.minimumCalories,
            maximumCalories: input.maximumCalories,
        },
    });
};

export const getDietOrderById = async (id: string): Promise<DietOrder | null> => {
    return db.dietOrder.findUnique({
        where: { id },
    });
};

export const getAllDietOrders = async (): Promise<DietOrder[]> => {
    return db.dietOrder.findMany();
};

export const updateDietOrder = async (input: UpdateDietOrderInput): Promise<DietOrder> => {
    return db.dietOrder.update({
        where: { id: input.id },
        data: {
            name: input.name,
            minimumCalories: input.minimumCalories,
            maximumCalories: input.maximumCalories,
        },
    });
};

export const deleteDietOrder = async (id: string): Promise<void> => {
    await db.$transaction(async (tx) => {
        // Delete associated patient diet orders first
        await tx.patientDietOrder.deleteMany({
            where: { dietOrderId: id },
        });

        // Delete the diet order
        await tx.dietOrder.delete({
            where: { id },
        });
    });
};

// ============================================================================
// PatientDietOrder CRUD
// ============================================================================

export const createPatientDietOrder = async (
    input: CreatePatientDietOrderInput
): Promise<PatientDietOrder> => {
    return db.patientDietOrder.create({
        data: {
            patientId: input.patientId,
            dietOrderId: input.dietOrderId,
        },
    });
};

export const getPatientDietOrder = async (id: string): Promise<PatientDietOrder | null> => {
    return db.patientDietOrder.findUnique({
        where: { id },
    });
};

export const getPatientDietOrderByPatient = async (
    patientId: string
): Promise<PatientDietOrder | null> => {
    return db.patientDietOrder.findFirst({
        where: { patientId },
    });
};

export const deletePatientDietOrder = async (id: string): Promise<void> => {
    await db.patientDietOrder.delete({
        where: { id },
    });
};

// ============================================================================
// TrayOrder CRUD
// ============================================================================

export type TrayOrderWithRecipes = TrayOrder & {
    recipes: Array<{
        id: string;
        recipeId: string;
        trayOrderId: string;
        recipe: Recipe;
    }>;
};

export const createTrayOrder = async (
    input: CreateTrayOrderInput
): Promise<TrayOrder> => {
    return db.trayOrder.create({
        data: {
            patientId: input.patientId,
            scheduledFor: input.scheduledFor,
            mealTime: toMealTimeEnum(input.mealTime),
            recipes: {
                create: input.recipeIds.map((recipeId) => ({ recipeId })),
            },
        },
    });
};

export const getTrayOrder = async (id: string): Promise<TrayOrderWithRecipes | null> => {
    return db.trayOrder.findUnique({
        where: { id },
        include: {
            recipes: {
                include: {
                    recipe: true,
                },
            },
        },
    });
};

export const getAllTrayOrders = async (): Promise<TrayOrder[]> => {
    return db.trayOrder.findMany();
};

export const updateTrayOrder = async (input: UpdateTrayOrderInput): Promise<TrayOrder> => {
    const updateData: any = {};

    if (input.scheduledFor !== undefined) {
        updateData.scheduledFor = input.scheduledFor;
    }
    if (input.mealTime !== undefined) {
        updateData.mealTime = toMealTimeEnum(input.mealTime);
    }

    return db.trayOrder.update({
        where: { id: input.id },
        data: updateData,
    });
};

export const deleteTrayOrder = async (id: string): Promise<void> => {
    await db.$transaction(async (tx) => {
        // Delete associated tray order recipes first
        await tx.trayOrderRecipe.deleteMany({
            where: { trayOrderId: id },
        });

        // Delete the tray order
        await tx.trayOrder.delete({
            where: { id },
        });
    });
};
