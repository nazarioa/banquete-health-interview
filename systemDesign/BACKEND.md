# Order System Backend

All data models are defined `COMMON.md`

This backend is for a just-in-time meal ordering system with dietary constraints.

The population it serves are "Patient"s in some kind of medical care.

A "Patient" has a "DietOrder" given to them by a provider that limits the amount of food a "Patient" can order from a
list of "Recipe"s.

When a "Patient" is entered into the system, they are entered with an initial "PatientDietOrder" which sets the "minimum_calories" and "maximum_calories" the "Patient" can eat for the day.

For each "meal_time" throughout the day the "Patient" should place a "TrayOrder" at least 4 hours before the "cut_off" for the "meal_time" "serve_time". If the "Patient" has not placed a "TrayOrder" by the cut-off time, then the automated system should place a "TrayOrder" on behalf of the "Patient", the "TrayOrder" must conform to the caloric limitations defined by "PatientDietOrders".

## API

API is broken up into three parts: PatientApi, AdminApi (ProviderAdminApi, KitchenAdminApi, SystemAdminApi), AutomatedApi

PatientApi focuses on calls needed by the frontend in order for a Patient to see what they can order, place an order, check the status of their order.

AdminApi allows adding, removing and changing of all data. Later will be refined to ProviderAdmin, and KitchenAdmin, SystemAdmin.

AutomatedApi focuses on calls that the system will do as reactions to events based on time (cron jobs) or changes on the system by Patient or Admins. Its primary function will be to check to see what "PatientDietOrders" do not have a corresponding "TrayOrder" by the cutt-off time and create a "TrayOrder" on behalf the "Patient" from the "Recipie" table that conforms to that "Patient"'s "PatientDietOrder"

### PatientApi

```typescript
/**
 * Returns the dailiy caloric limitations plus the remining allotoment.
 * "patient_id" read from session context
 */
function getDietOrder(): DietOrderResponse;
type DietOrderResponse = {
   minimum_calories: number;
   maximum_calories: number;
   calories_consumed: number; // The sum of all calories eaten that day
};
```

```typescript
/**
 * Returns a list of Recipes that conform to the "Patient"'s caloric constraint for the given "meal_time"
 * @param patientId
 * @param category - type of meal item (Beverage, Entree, Side, Dessert)
 */
function getAvailableRecipes(patientId: string, category?: ItemCategory): RecipeResponse;

type RecipeResponse = {
   recipes: Array<Recipie>;
};
```

```typescript
/**
 * For a given mealTime, returns a list of all meals schedualed plus or minus a week ordered by TrayOrder.schdualed_for.
 * If no mealTime is given, all meals are listsed.
 * If showPast is set to true it includes past listings
 * "patient_id" read from session context.
 */
function getTrayOrders(
   mealTime?: 'breakfast' | 'lunch' | 'dinner' | 'snack',
   showPast?: boolean,
): MealsResponse;

type SchedualedTrayResponse = {
   schedualed: Array<{
      tray: TrayOrder;
      recipie: Recipie;
   }>;
};
```

```typescript
/**
 * Post to place on or more
 * "patient_id" read from session context
 */
function postTrayOrders(request: TrayOrderRequest): TrayOrderResponse;

type TrayOrderResponse = {
   trayOrder: Array<TrayOrder>;
};

type TrayOrderRequest = {
   trays: Array<{
      schdualed_for: Date; // DateTime
      mealTime: 'breakfast' | 'lunch' | 'dinner' | 'snack';
      recipie_id: string;
   }>;
};
```

```typescript
/**
 * DELETE for a Patient to remove a series of "TrayOrder"s.
 * Allows the removal of multiple TrayOrders
 * "patient_id" read from session context
 */
function deleteTrayOrders(trayOrderIds: Array<string>);
```

### AutomatedApi

```typescript
/**
 * Returns the dailiy caloric limitations plus the remining allotoment for a given patient
 */
function getAdminDietOrder(patient_id: string): DietOrderResponse;
type DietOrderResponse = {
   minimum_calories: number;
   maximum_calories: number;
   calories_consumed: number; // The sum of all calories eaten that day
};
```

```typescript
/**
 * Returns a list of Recipes that conform to the "Patient"'s caloric constraint for the given "meal_time"
 * @param patientId
 * @param category - type of meal item (Beverage, Entree, Side, Dessert)
 */
function getAvailableRecipes(patientId: string, category?: ItemCategory): RecipeResponse;

type RecipeResponse = {
   recipes: Array<Recipie>;
};
```

There needs to be in a helper function that is used by `getDietOrder` that calculates the amount of calories consumed by
the "Patient" for that day.

To calculate this, for a given patient_id, query "TrayOrder" scheduled between 12:01AM till now. Join with "Recipie" via "TrayOrderRecipie". Foreach found, sum the "calories" in "Recipie". This sum is called the "CalorieRunningSum".

```typescript
/**
 * The sum of all calories eaten that day by a given "Patient"
 */
function calcualteCaloriesConsumed(patientId: string, date: Date): number;
```

The `executePrep` function will be called via cron job. It will be called three times a day, 4 hours before each "meal_time" serve time as follows:

| meal_time | serve time | Cron Job Execute Time |
| --------- | ---------- | --------------------- |
| brakfast  | 8:00 AM    | 4:00 AM               |
| lunch     | 12:00 PM   | 8:00 AM               |
| dinner    | 6:00 PM    | 2:00 PM               |

```typescript
function executePrep(mealTime: 'brakfast' | 'lunch' | 'dinner');
```

The `executePrep` function will be called at the corresponding times with the `mealTime` value.

When `executePrep` is run, for each patient, it needs to see if a "TrayOrder" exists for that day and that "mealTime". If the "Patient" has a "TrayOrder", do nothing, otherwise the automated system must create a "TrayOrder" on behalf of the "Patient".

For the automated system to place a "TrayOrder" it must query `getAdminDietOrder()` to get the
