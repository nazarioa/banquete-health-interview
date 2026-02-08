import { MealTime, TrayOrder, Recipe } from '@prisma/client';

// TODO: This needs to be included as part of Prisma data type. And made to be LowerCase
export type ItemCategory = 'Sides' | 'Beverages' | 'Desserts' | 'Entrees';


// Lowercase mealTime type for API layer
export type MealTimeInput = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type MealTimeHour = 'breakfast' | 'lunch' | 'dinner';

// Helper to convert API input to Prisma enum
export const toMealTimeEnum = (input: MealTimeInput): MealTime => {
    return input.toUpperCase() as MealTime;
};

// Helper to convert Prisma enum to API type
export const fromMealTimeEnum = (mealTime: MealTime): MealTimeInput => {
    return mealTime.toLowerCase() as MealTimeInput;
};

// PatientApi Response Types
export type DietOrderResponse = {
    minimum_calories: number;
    maximum_calories: number;
    calories_consumed: number;
};

export type RecipeResponse = {
    recipes: Recipe[];
};

export type ScheduledTrayResponse = {
    scheduled: Array<{
        tray: TrayOrder;
        recipes: Recipe[];
    }>;
};

// PatientApi Request Types
export type TrayOrderRequest = {
    trays: Array<{
        scheduled_for: Date;
        mealTime: MealTimeInput;
        recipe_ids: string[];
    }>;
};

export type TrayOrderResponse = {
    trayOrders: TrayOrder[];
};

export type DeleteTrayOrdersResponse = {
    deletedCount: number;
};

// AutomatedApi Types
export type ExecutePrepResponse = {
    patientsProcessed: number;
    ordersCreated: number;
    errors: Array<{ patientId: string; error: string }>;
};

// AdminApi Input Types
export type CreatePatientInput = {
    name: string;
};

export type UpdatePatientInput = {
    id: string;
    name?: string;
};

export type CreateRecipeInput = {
    name: string;
    category: string;
    calories: number;
};

export type UpdateRecipeInput = {
    id: string;
    name?: string;
    category?: string;
    calories?: number;
};

export type CreateDietOrderInput = {
    name: string;
    minimumCalories?: number;
    maximumCalories?: number;
};

export type UpdateDietOrderInput = {
    id: string;
    name?: string;
    minimumCalories?: number;
    maximumCalories?: number;
};

export type CreatePatientDietOrderInput = {
    patientId: string;
    dietOrderId: string;
};

export type CreateTrayOrderInput = {
    patientId: string;
    scheduledFor: Date;
    mealTime: MealTimeInput;
    recipeIds: string[];
};

export type UpdateTrayOrderInput = {
    id: string;
    scheduledFor?: Date;
    mealTime?: MealTimeInput;
};
