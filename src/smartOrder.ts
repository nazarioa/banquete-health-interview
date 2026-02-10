/**
 * I envision the `SmartOrderSystem` being triggered via cron.
 *
 * Usage: npx ts-node src/smartOrder.ts <email> <password>
 */

const BASE_URL = 'http://localhost:3000/api';

type MealTime = 'breakfast' | 'lunch' | 'dinner';

/**
 * Determines the meal time based on the current time.
 * Returns null if outside of any trigger window.
 *
 * | time frame      | mealTime  |
 * |-----------------|-----------|
 * | 3:30am - 4:00am | breakfast |
 * | 7:30am - 8:00am | lunch     |
 * | 1:30pm - 2:00pm | dinner    |
 */
const getMealTimeForCurrentTime = (now: Date = new Date()): MealTime | null => {
   const hours = now.getHours();
   const minutes = now.getMinutes();
   const timeInMinutes = hours * 60 + minutes;

   // 3:30am - 4:00am → breakfast (210 - 240 minutes)
   if (timeInMinutes >= 210 && timeInMinutes < 240) {
      return 'breakfast';
   }

   // 7:30am - 8:00am → lunch (450 - 480 minutes)
   if (timeInMinutes >= 450 && timeInMinutes < 480) {
      return 'lunch';
   }

   // 1:30pm - 2:00pm → dinner (810 - 840 minutes)
   if (timeInMinutes >= 810 && timeInMinutes < 840) {
      return 'dinner';
   }

   return null;
};

/**
 * Authenticates with the admin API and returns a JWT token.
 */
const login = async (email: string, password: string): Promise<string> => {
   const response = await fetch(`${BASE_URL}/admin/auth/login`, {
      method: 'POST',
      headers: {
         'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
   });

   if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Login failed: ${response.status} ${error.error || response.statusText}`);
   }

   const data = await response.json();
   return data.token;
};

export const triggerSmartOrderSystem = async (email: string, password: string): Promise<void> => {
   const mealTime = getMealTimeForCurrentTime();

   if (!mealTime) {
      console.log('Outside of meal prep trigger window. No action taken.');
      return;
   }

   // Authenticate first
   console.log('Authenticating...');
   const token = await login(email, password);
   console.log('Authentication successful.');

   // Trigger the smart order system
   const url = `${BASE_URL}/automated/execute-prep/${mealTime}`;

   const response = await fetch(url, {
      method: 'POST',
      headers: {
         'Content-Type': 'application/json',
         Authorization: `Bearer ${token}`,
      },
   });

   if (!response.ok) {
      throw new Error(
         `Failed to trigger smart order system: ${response.status} ${response.statusText}`,
      );
   }

   const result = await response.json();
   console.log(`Smart order system triggered for ${mealTime}:`, result);
};

// CLI entry point
const main = async () => {
   const args = process.argv.slice(2);

   if (args.length < 2) {
      console.error('Usage: npx ts-node src/smartOrder.ts <email> <password>');
      process.exit(1);
   }

   const [email, password] = args;

   try {
      await triggerSmartOrderSystem(email, password);
   } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
   }
};

main();

export default main;
