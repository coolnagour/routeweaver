
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
        const result = await db.update(users)
            .set({
                email: validatedData.email,
                displayName: validatedData.displayName,
                photoURL: validatedData.photoURL,
            })
            .where(eq(users.id, validatedData.id));
        
        // In Turso, a successful update that changes rows returns a rowsAffected count of 1.
        // If no rows were updated (because the user didn't exist), we need to insert.
        // Note: some drivers/dialects might behave differently, this is tailored for Turso/http.
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
        // If the update fails for reasons other than not found, we might need more specific error handling.
        // For now, we assume any error means we should try to insert if the update failed.
        // A better approach for production might be to check the error type.
        try {
             await db.insert(users).values({
                id: validatedData.id,
                email: validatedData.email,
                displayName: validatedData.displayName,
                photoURL: validatedData.photoURL,
            });
        } catch (insertError) {
             console.error("Failed to insert user after update failed:", insertError);
             throw insertError; // Re-throw the insert error if it also fails
        }
    }


    return { success: true };
}
