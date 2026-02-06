# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Smart Ordering system for Banquet Health that automatically generates meal orders for hospital patients who haven't placed their own orders. The system must respect each patient's dietary constraints (min/max daily calories) and avoid duplicate orders.

## Commands

```bash
# Database
npm run db-up        # Start PostgreSQL container (Docker)
npm run db-down      # Stop container
npm run db-clean     # Stop container and remove volumes
npm run init-db      # Initialize and seed database
npm run reset-db     # Reset database to seed state

# Development
npm start            # Run the smart order system (ts-node src/entrypoint.ts)
npm run test         # Run Jest tests (resets DB before each test)
```

Database connection: `postgresql://postgres:local@localhost:5442/dev`

## Architecture

**Tech Stack:** TypeScript, Prisma ORM, PostgreSQL (Docker), Jest

**Core Files:**
- `src/smartOrder.ts` - Main implementation file for `triggerSmartOrderSystem()`
- `src/db.ts` - Prisma client singleton
- `src/entrypoint.ts` - CLI entry point

**Database Schema (`prisma/schema.prisma`):**
- `Patient` - Has many `TrayOrder`s and `PatientDietOrder`s
- `DietOrder` - Defines calorie constraints (min/max daily calories)
- `PatientDietOrder` - Links patients to their diet orders
- `TrayOrder` - Meal order with `scheduledFor` date and `mealTime` (BREAKFAST, LUNCH, DINNER, SNACK)
- `Recipe` - Menu items with calories and category
- `TrayOrderRecipe` - Links recipes to tray orders

**Key Business Rules:**
- Smart Ordering handles BREAKFAST, LUNCH, DINNER only (not SNACK)
- Must not duplicate existing orders for a patient/meal
- Must track daily calorie consumption against diet order constraints

## Testing

Tests use Jest with automatic database reset before each test. The test framework is configured in `test/jest.config.js` with:
- Global setup restores database to seed state
- `setupFilesAfterEnv` runs before each test file
- Single worker (`maxWorkers: 1`) for database isolation
- 20 second timeout per test

Seed data location: `prisma/seed/rawData/*.csv`

## Backend Technical Outline

See `systemDesign/BACKEND.md` and `systemDesign/COMMON.md` for detailed API and data model specifications.

**Key Functions to Implement:**

1. `calculateCaloriesConsumed(patientId, date)` - Sum calories from TrayOrders scheduled between 12:01AM and now, joined with Recipe via TrayOrderRecipe

2. `executePrep(mealTime)` - Called via cron 4 hours before each meal serve time:
   - breakfast: 4:00 AM (serves 8:00 AM)
   - lunch: 8:00 AM (serves 12:00 PM)
   - dinner: 2:00 PM (serves 6:00 PM)

   For each patient without a TrayOrder for that day/mealTime, create one that conforms to their PatientDietOrder caloric limits.

**API Structure (planned):**
- PatientApi - Patient-facing calls for viewing/placing orders
- AdminApi - CRUD operations for all data
- AutomatedApi - System-triggered operations (cron jobs, event reactions)
