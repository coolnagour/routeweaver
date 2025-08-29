
'use server';

import { db } from '@/lib/drizzle';
import { users } from '@/lib/drizzle/schema';
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

    await db.insert(users).values({
        id: validatedData.id,
        email: validatedData.email,
        displayName: validatedData.displayName,
        photoURL: validatedData.photoURL,
    }).onConflictDoUpdate({
        target: users.id,
        set: {
            email: validatedData.email,
            displayName: validatedData.displayName,
            photoURL: validatedData.photoURL,
        }
    });

    return { success: true };
}
