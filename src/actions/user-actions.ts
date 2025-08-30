
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

    // This logic performs a more reliable "upsert" for Turso/libSQL.
    // It first attempts an update. If no rows are affected, it means the user
    // does not exist, and it proceeds to insert the new user.
    try {
        const result = await db.update(users)
            .set({
                email: validatedData.email,
                displayName: validatedData.displayName,
                photoURL: validatedData.photoURL,
            })
            .where(eq(users.id, validatedData.id));

        if (result.rowsAffected === 0) {
            await db.insert(users).values({
                id: validatedData.id,
                email: validatedData.email,
                displayName: validatedData.displayName,
                photoURL: validatedData.photoURL,
            });
        }
    } catch (error) {
        console.error("Error during upsertUser:", error);
        // If the update fails for a reason other than "not found" (e.g., database connection issue),
        // we re-throw the error to ensure it's surfaced.
        throw error;
    }

    return { success: true };
}
