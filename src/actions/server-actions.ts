
'use server';

import { db } from '@/lib/drizzle';
import { servers } from '@/lib/drizzle/schema';
import type { ServerConfig } from '@/types';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function getServers(): Promise<ServerConfig[]> {
  try {
    const serverList = await db.query.servers.findMany();
    return serverList;
  } catch (error) {
    console.error("Failed to fetch servers:", error);
    return [];
  }
}

export async function saveServer(server: ServerConfig): Promise<{ success: boolean; message?: string }> {
  try {
    if (server.uuid) {
      // Update
      await db.update(servers).set(server).where(eq(servers.uuid, server.uuid));
    } else {
      // Insert
      await db.insert(servers).values(server);
    }
    revalidatePath('/settings/servers');
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error("Failed to save server:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    if (errorMessage.includes('UNIQUE constraint failed')) {
        return { success: false, message: 'A server with this Host and Company ID already exists.' };
    }
    return { success: false, message: errorMessage };
  }
}

export async function deleteServer(uuid: string): Promise<{ success: boolean; message?: string }> {
    try {
        await db.delete(servers).where(eq(servers.uuid, uuid));
        revalidatePath('/settings/servers');
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error("Failed to delete server:", error);
        return { success: false, message: error instanceof Error ? error.message : 'An unknown error occurred.' };
    }
}
