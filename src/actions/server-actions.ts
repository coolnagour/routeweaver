
'use server';

import persistenceService from '@/services/persistence-service';
import type { ServerConfig } from '@/types';
import { revalidatePath } from 'next/cache';
import { auth } from 'firebase-admin';

// Note: In server-side persistence mode, these actions are not user-specific.
// In a real-world multi-tenant app, you would pass the userId to the persistence layer.
// For this app's purpose (single user or all users share servers), this is okay.

export async function getServers(): Promise<ServerConfig[]> {
  try {
    const serverList = await persistenceService.getServers();
    return serverList;
  } catch (error) {
    console.error("Failed to fetch servers:", error);
    return [];
  }
}

export async function saveServer(server: ServerConfig): Promise<{ success: boolean; message?: string }> {
  try {
    await persistenceService.saveServer(server);
    revalidatePath('/settings/servers');
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error("Failed to save server:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    // This UNIQUE constraint check is specific to the Drizzle/Turso implementation
    // A more generic approach would involve parsing error codes if the adapter provided them.
    if (errorMessage.includes('UNIQUE constraint failed')) {
        return { success: false, message: 'A server with this Host and Company ID already exists.' };
    }
    return { success: false, message: errorMessage };
  }
}

export async function deleteServer(uuid: string): Promise<{ success: boolean; message?: string }> {
    try {
        await persistenceService.deleteServer(uuid);
        revalidatePath('/settings/servers');
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error("Failed to delete server:", error);
        return { success: false, message: error instanceof Error ? error.message : 'An unknown error occurred.' };
    }
}
