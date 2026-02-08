import { db } from '../../db';
import { Recipe } from '@prisma/client';
import { DietOrderResponse, MealTimeHour } from './types';

const DESSERT_CALORIE_APPROXIMATION = 120;

const CALORIE_OF_QUICK_SNAK = 100;

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
   const _mealCalorieTargetBase = Math.floor(
      // calculate the average calorie count per day and then divide that over a day (three meals).
      (dietOrder.maximumCalories + dietOrder.minimumCalories) / 2 / 3,
   );
   const targetDinner = _mealCalorieTargetBase + DESSERT_CALORIE_APPROXIMATION;
   const targetBreakfastLunch = _mealCalorieTargetBase - DESSERT_CALORIE_APPROXIMATION / 2;

   // This calculates the number of calories we must adjust based on previous eating (like snacks)
   let adjustedTarget: number;
   if (mealTime === 'dinner') {
      // subtract from the targetDinner any unexpected over or under consumption aside from the expected 2 meals, breakfast and lunch to get dinners target true target.
      adjustedTarget = targetDinner - (dietOrder.caloriesConsumed - targetBreakfastLunch * 2);
   } else if (mealTime === 'lunch') {
      // subtract from the targetBreakfastLunch any unexpected over or under consumption aside from the expected breakfast and lunch to get dinners target true target.
      adjustedTarget = targetBreakfastLunch - (dietOrder.caloriesConsumed - targetBreakfastLunch);
   } else {
      // if Patient had a snack before breakfast, it would show here but most of the time caloriesConsumed in the morning will be 0.
      adjustedTarget = targetBreakfastLunch - dietOrder.caloriesConsumed;
   }

   return adjustedTarget;
};

/**
 * Builds a complete meal based on the amount of calories available and the type of mealTime.
 * Slightly opinionated and should be reviewed by product...
 *
 * If the patient has a zero `mealCalorieTarget` a zero calorie drink (water) is returned.
 * If the patient has a CALORIE_OF_QUICK_SNAK or less of available calories to consume, return a snack and a zero calorie drink.
 * After that:
 * - Try to add the heaviest caloric items (entree).
 * - Then a side (ahead of dessert or beverage) as the assumption is that they have a higher nutritional value.
 * - Followed by a dessert if mealTime is dinner, and they have the calories.
 * - Then offer a drink if they have the calories.
 * - Up two sides so long as they are within bounds
 *
 *
 *
 * @param mealTime - Used to figure out if desert should be included. Could also be used to keep high caloric drinks to breakfast.
 * @param mealCalorieTarget - what THIS meals calorie target should be. For example, if they Patient had a large breakfast,
 * this function should call with a lower value to still give the Patient somthing but not push them over a limit.
 * @param menuItems
 */
export const mealBuilder = (
   mealTime: MealTimeHour,
   mealCalorieTarget: number,
   menuItems: {
      entrees: Array<Recipe>;
      beverages: Array<Recipe>;
      sides: Array<Recipe>;
      desserts: Array<Recipe>;
   },
): Array<Recipe> => {
   const zeroCal = [menuItems.sides.find((s) => s.calories === 0)].filter((x) => !!x);

   // If patient has no calorie budget we should at least something with zero calories.
   if (mealCalorieTarget <= 0) return zeroCal;

   // If the patient has a very small calorie budget (the size of a snack) return that.
   // If nothing is found, return at least something with zero calories.
   const aSmallBite = menuItems.sides.find((s) => s.calories <= mealCalorieTarget);
   if (mealCalorieTarget <= CALORIE_OF_QUICK_SNAK && mealCalorieTarget > 0) {
      return aSmallBite ? [aSmallBite, ...zeroCal] : zeroCal;
   }

   const selected: {
      beverage: Recipe | null;
      dessert: Recipe | null;
      entree: Recipe | null;
      sides: Array<Recipe>;
   } = {
      beverage: null,
      dessert: null,
      entree: null,
      sides: [],
   };

   let loopCount = 0;
   let remainingCalories = mealCalorieTarget;

   // keep trying combinations until
   while (remainingCalories > (-1 * CALORIE_OF_QUICK_SNAK) / 2) {
      const indexOfRandomEntree = Math.floor(Math.random() * menuItems.entrees.length);
      const entree = menuItems.entrees[indexOfRandomEntree];
      if (entree && remainingCalories > entree.calories) {
         selected.entree = entree;
         remainingCalories = remainingCalories - selected.entree.calories;
      }

      // If the patient only has enough calorie budget for an entree and snack, serve that.
      if (remainingCalories <= CALORIE_OF_QUICK_SNAK) {
         const aSmallBite = menuItems.sides.find((s) => s.calories <= mealCalorieTarget);
         return [selected.entree, aSmallBite, ...zeroCal].filter((x) => !!x);
      }

      // offer them the first side...
      const indexOfSide1 = Math.floor(Math.random() * menuItems.sides.length);
      const side1 = menuItems.sides[indexOfSide1];
      if (side1 && remainingCalories >= side1.calories) {
         remainingCalories = remainingCalories - side1.calories;
         selected.sides.push(side1);
      }

      // Only offer dessert if dinner and they have the budget.
      const indexOfDessert = Math.floor(Math.random() * menuItems.desserts.length);
      const dessert = menuItems.desserts[indexOfDessert];

      if (mealTime === 'dinner' && dessert && remainingCalories >= dessert.calories) {
         remainingCalories = remainingCalories - dessert.calories;
         selected.beverage = dessert;
      }

      const indexOfRandomBeverage = Math.floor(Math.random() * menuItems.beverages.length);
      const beverage = menuItems.beverages[indexOfRandomBeverage];
      if (beverage && remainingCalories >= beverage.calories) {
         remainingCalories = remainingCalories - beverage.calories;
         selected.beverage = beverage;
      }

      // let them have up to 2 more sides if they have the budget.
      for (let i = 0; i < 2 && remainingCalories > (CALORIE_OF_QUICK_SNAK * -1) / 2; i++) {
         const indexOfSide = Math.floor(Math.random() * menuItems.sides.length);
         const side = menuItems.sides[indexOfSide];
         if (side && remainingCalories > side.calories) {
            selected.sides.push(side);
            remainingCalories = remainingCalories - side.calories;
         }
      }

      if (remainingCalories <= 0) {
         return [
            selected.entree,
            selected.beverage,
            selected.dessert,
            ...selected.sides,
            ...zeroCal,
         ].filter((x) => !!x);
      }

      // If code gets here, it was not able to build a meal.
      // return an empty array to trigger a failed response.
      loopCount++;
      if (loopCount === 5) break;
   }

   return [];
};
