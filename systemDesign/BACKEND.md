Order System Backend
====================

All data models are defined `COMMON.md`

This backend is for a just-in-time meal ordering system with dietary constraints.

The population it serves are "Patient"s in some kind of medical care.

A "Patient" has a "DietOrder" given to them by a provider that limits the amount of food a "Patient" can order from a 
list of "Recipe"s.

When a "Patient" is entered into the system, they are entered with an initial "PatientDietOrder" which sets the "minimum_calories" and "maximum_calories" the "Patient" can eat for the day.

For each "meal_time" throughout the day the "Patient" should place a "TrayOrder" at least 6 hours before the "cut_off" for the "Recipie"'s category type. If the "Patient" has not placed a "TrayOrder" by the cut-off time, then the automated system should place a "TrayOrder" on behalf of the "Patient", the "TrayOrder" must conform to the caloric limitations defined by "PatientDietOrders".

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
  remianing_calories: number; // difference between  `maximum_calories` and the sum of all calories eaten that day
} 
```

```typescript
/**
 * Returns a list of meals that conform to the "Patient"'s caloric onstraint for the given meal category
 * "patient_id" read from session context.
 * @param category
 */
function getAvailableMeals(category: 'breakfast' | 'lunch' | 'dinner' | 'snack' ): MealsResponse;

type MealsResponse = {
  meals: Array<Recipie>
}
```

```typescript
/**
 * For a given category, returns a list of all meals schedualed plus or minus a week ordered by TrayOrder.schdualed_for.
 * If no category is given, all meals are listsed.
 * If showPast is set to true it includes past listings
 * "patient_id" read from session context.
 */
function getSchedualedTrays(category?: 'breakfast' | 'lunch' | 'dinner' | 'snack', showPast?: boolean): MealsResponse;

type SchedualedTrayResponse = {
  schedualed: Array<{
    tray: TrayOrder
    recipie: Recipie
  }>
}
```