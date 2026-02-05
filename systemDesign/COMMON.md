These models look as follows
```typescript
type Patient = {
  id: string; // UUID
  name: string;
}

type Recipie = {
  id: string; // UUID
  name: string;
  // category_id: string; // ForgeinKey MealCategory.id
  category: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  calories: number;
}

type DietOrder = {
  id: string; // UUID
  name: string;
  minimum_calories: number;
  maximum_calories: number;
}

type PatientDietOrder = {
  id: string; // UUID
  patient_id: string; // ForgeinKey Patient.id
  diet_order_id: string; // ForgeinKey DietOrder.id
}

type TrayOrder = {
  id: string; // UUID
  schdualed_for: Date; // DateTime
  meal_time: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  patient_id: string;  // ForgeinKey Patient.id
}

/*
type MealCategory = {
  id: string; // UUID
  category: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  cut_off: Time; // hour when orders must be submitted
}
*/
```
