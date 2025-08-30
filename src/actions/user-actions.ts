
'use server';

import { db } from '@/lib/drizzle';
import { users } from '@/lib/drizzle/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// Schema for user data coming from the client
const UserSchema = z.object({
    id: z.string(),
    email: z.string().email(),
    displayName: z.string().nullable().optional(),
    photoURL: z.string().url().nullable().optional(),
});
export type UserData = z.infer<typeof UserSchema>;


export async function upsertUser(userData: UserData) {
    const validatedData = UserSchema.parse(userData);

    try {
        // This is a more robust upsert logic that first queries for the user.
        // It's more compatible than relying on `rowsAffected` which can be inconsistent.
        const existingUser = await db.query.users.findFirst({
            where: eq(users.id, validatedData.id),
        });

        if (existingUser) {
            // User exists, update them
            await db.update(users)
                .set({
                    email: validatedData.email,
                    displayName: validatedData.displayName,
                    photoURL: validatedData.photoURL,
                })
                .where(eq(users.id, validatedData.id));
        } else {
            // User does not exist, insert them
            await db.insert(users).values({
                id: validatedData.id,
                email: validatedData.email,
                displayName: validatedData.displayName,
                photoURL: validatedData.photoURL,
            });
        }
    } catch (error) {
        console.error("Error during upsertUser:", error);
        // Re-throw the error to ensure it's surfaced.
        throw error;
    }

    return { success: true };
}
