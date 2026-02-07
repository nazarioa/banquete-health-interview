import { db } from '../../src/db';
import { calculateCaloriesConsumed, getStartOfDay, getEndOfDay, getDateRangeForWeek } from '../../src/server/internal/helpers';

describe('helpers', () => {
    describe('getStartOfDay', () => {
        it('returns 12:01 AM of the given date', () => {
            const date = new Date('2025-01-15T14:30:00');
            const result = getStartOfDay(date);

            expect(result.getHours()).toBe(0);
            expect(result.getMinutes()).toBe(1);
            expect(result.getSeconds()).toBe(0);
            expect(result.getDate()).toBe(15);
            expect(result.getMonth()).toBe(0); // javascript months are zero index
            expect(result.getFullYear()).toBe(2025);
        });
    });

    describe('getEndOfDay', () => {
        it('returns 11:59:59 PM of the given date', () => {
            const date = new Date('2025-01-15T14:30:00');
            const result = getEndOfDay(date);

            expect(result.getHours()).toBe(23);
            expect(result.getMinutes()).toBe(59);
            expect(result.getSeconds()).toBe(59);
            expect(result.getDate()).toBe(15);
            expect(result.getMonth()).toBe(0); // javascript months are zero index
            expect(result.getFullYear()).toBe(2025);
        });
    });

    describe('getDateRangeForWeek', () => {
        it('returns date range +/- 7 days from base date (rolling week window)', () => {
            const baseDate = new Date('2025-01-15T12:00:00');
            const { start, end } = getDateRangeForWeek(baseDate);

            expect(start.getDate()).toBe(8);
            expect(end.getDate()).toBe(22);
        });
    });

    // DISAPPROVED - These tests are not being mocked.
    describe('calculateCaloriesConsumed', () => {
        // Use the seed data patient: Mark Corrigan
        const seedPatientId = '7ea4e6ec-f359-485b-ac99-e0b44c3e18b9';

        it('returns 0 when patient has no tray orders for the date', async () => {
            // Create a new patient with no orders
            const patient = await db.patient.create({
                data: { name: 'Test Patient No Orders' }
            });

            const result = await calculateCaloriesConsumed(patient.id, new Date());

            expect(result).toBe(0);
        });

        it('sums calories from tray orders with recipes', async () => {
            // Create test data
            const patient = await db.patient.create({
                data: { name: 'Test Patient Calories' }
            });

            const recipe1 = await db.recipe.create({
                data: { name: 'Test Recipe 1', category: 'Entrees', calories: 300 }
            });

            const recipe2 = await db.recipe.create({
                data: { name: 'Test Recipe 2', category: 'Sides', calories: 150 }
            });

            // Create a tray order for today with both recipes
            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

            const trayOrder = await db.trayOrder.create({
                data: {
                    patientId: patient.id,
                    scheduledFor: oneHourAgo,
                    mealTime: 'BREAKFAST',
                    recipes: {
                        create: [
                            { recipeId: recipe1.id },
                            { recipeId: recipe2.id }
                        ]
                    }
                }
            });

            const result = await calculateCaloriesConsumed(patient.id, now);

            expect(result).toBe(450); // 300 + 150
        });

        it('sums calories from multiple tray orders on the same day', async () => {
            const patient = await db.patient.create({
                data: { name: 'Test Patient Multiple Orders' }
            });

            const recipe1 = await db.recipe.create({
                data: { name: 'Breakfast Item', category: 'Entrees', calories: 400 }
            });

            const recipe2 = await db.recipe.create({
                data: { name: 'Lunch Item', category: 'Entrees', calories: 600 }
            });

            const now = new Date();
            const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

            // Create breakfast order
            await db.trayOrder.create({
                data: {
                    patientId: patient.id,
                    scheduledFor: twoHoursAgo,
                    mealTime: 'BREAKFAST',
                    recipes: {
                        create: [{ recipeId: recipe1.id }]
                    }
                }
            });

            // Create lunch order
            await db.trayOrder.create({
                data: {
                    patientId: patient.id,
                    scheduledFor: oneHourAgo,
                    mealTime: 'LUNCH',
                    recipes: {
                        create: [{ recipeId: recipe2.id }]
                    }
                }
            });

            const result = await calculateCaloriesConsumed(patient.id, now);

            expect(result).toBe(1000); // 400 + 600
        });

        it('excludes tray orders from previous days', async () => {
            const patient = await db.patient.create({
                data: { name: 'Test Patient Previous Day' }
            });

            const recipe = await db.recipe.create({
                data: { name: 'Yesterday Item', category: 'Entrees', calories: 500 }
            });

            // Create order for yesterday
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            await db.trayOrder.create({
                data: {
                    patientId: patient.id,
                    scheduledFor: yesterday,
                    mealTime: 'LUNCH',
                    recipes: {
                        create: [{ recipeId: recipe.id }]
                    }
                }
            });

            const result = await calculateCaloriesConsumed(patient.id, new Date());

            expect(result).toBe(0);
        });

        it('excludes tray orders scheduled for future times today', async () => {
            const patient = await db.patient.create({
                data: { name: 'Test Patient Future Order' }
            });

            const recipe = await db.recipe.create({
                data: { name: 'Future Item', category: 'Entrees', calories: 700 }
            });

            // Create order for 2 hours from now
            const now = new Date();
            const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

            await db.trayOrder.create({
                data: {
                    patientId: patient.id,
                    scheduledFor: twoHoursFromNow,
                    mealTime: 'DINNER',
                    recipes: {
                        create: [{ recipeId: recipe.id }]
                    }
                }
            });

            const result = await calculateCaloriesConsumed(patient.id, now);

            expect(result).toBe(0);
        });
    });
});
