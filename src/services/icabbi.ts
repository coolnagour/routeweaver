
'use server';

import type { ServerConfig } from "@/types";
import type { Booking, Account, Site } from "@/types";
import { formatBookingForApi } from "@/lib/booking-formatter";

interface IcabbiApiCallOptions {
    server: ServerConfig;
    method: 'GET' | 'POST' | 'DELETE';
    endpoint: string;
    body?: any;
}

export async function callIcabbiApi({ server, method, endpoint, body }: IcabbiApiCallOptions) {
    let url = `https://${server.host}/${server.apiPath}/${endpoint}`;
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}app_key=${server.appKey}`;

    const bodyString = body ? JSON.stringify(body) : '';
    
    const headers = new Headers({
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${server.appKey}:${server.secretKey}`).toString('base64'),
    });
    
    const options: RequestInit = {
        method,
        headers,
    };
    
    if (body) {
        options.body = bodyString;
    }

    console.log(`[iCabbi API Request] ---> ${method} ${url}`);
    if (body) {
        console.log(`[iCabbi API Request Body]:`, JSON.stringify(body, null, 2));
    }
    
    try {
        const response = await fetch(url, options);
        
        const responseText = await response.text();
        console.log(`[iCabbi API Response] <--- Status: ${response.status}`);
        if (responseText) {
            console.log(`[iCabbi API Response Body]:`, responseText);
        }


        if (!response.ok) {
            console.error('iCabbi API Error:', response.status, responseText);
            throw new Error(`API call failed with status ${response.status}: ${responseText || response.statusText}`);
        }
        
        if (response.status === 204 || !responseText) {
            return null;
        }

        const jsonResponse = JSON.parse(responseText);

        if (jsonResponse.status && jsonResponse.status.type === 'error' || jsonResponse.error) {
            const errorMessage = jsonResponse.message || (jsonResponse.status && jsonResponse.status.message) || 'Unknown API error';
            console.error('iCabbi API Logic Error:', errorMessage);
            throw new Error(`API Error: ${errorMessage}`);
        }

        return jsonResponse;

    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}

interface BookingApiContext {
    booking: Booking;
    siteId: number;
    accountId: number;
}

export async function createBooking(server: ServerConfig, { booking, siteId, accountId }: BookingApiContext) {
    const payload = formatBookingForApi({ booking, server, siteId, accountId });

    const response = await callIcabbiApi({
        server,
        method: 'POST',
        endpoint: 'bookings/add',
        body: payload,
    });
    
    return response.body.booking;
}

export async function updateBooking(server: ServerConfig, { booking, siteId, accountId }: BookingApiContext) {
    if (!booking.bookingServerId) {
        throw new Error("Booking must have a bookingServerId to be updated.");
    }
    const payload = formatBookingForApi({ booking, server, siteId, accountId });

    const response = await callIcabbiApi({
        server,
        method: 'POST',
        endpoint: `bookings/update/${booking.bookingServerId}`,
        body: payload,
    });
    
    return response.body.booking;
}

export async function getBookingById(server: ServerConfig, permaId: number) {
    const response = await callIcabbiApi({
        server,
        method: 'GET',
        endpoint: `bookings/index/${permaId}`,
    });

    if (response && response.body && response.body.booking) {
        return response.body.booking;
    }

    throw new Error(`Booking with perma_id ${permaId} not found or invalid response.`);
}

export async function deleteBooking(server: ServerConfig, bookingId: number) {
    const response = await callIcabbiApi({
        server,
        method: 'DELETE',
        endpoint: `bookings/delete/${bookingId}`,
    });
    return response;
}

export async function createJourney(server: ServerConfig, journeyPayload: any) {
    const response = await callIcabbiApi({
        server,
        method: 'POST',
        endpoint: 'journey/update',
        body: journeyPayload,
    });

    return response.body;
}

export async function sendDriverAppEvent(server: ServerConfig, type: string, bookingId: number) {
    const payload = {
        type,
        context: {
            booking_id: bookingId,
        },
    };

    const response = await callIcabbiApi({
        server,
        method: 'POST',
        endpoint: 'drivers/app_events',
        body: payload,
    });

    return response;
}

export async function getSites(server: ServerConfig): Promise<Site[]> {
    const response = await callIcabbiApi({
        server,
        method: 'GET',
        endpoint: 'sites',
    });
    
    if (response && response.body && response.body.sites) {
        return response.body.sites.map((site: any) => ({
            id: site.id,
            name: site.title,
            ref: site.ref,
        }));
    }
    return [];
}

export async function searchSitesByName(server: ServerConfig, query?: string, options: { limit?: number, offset?: number } = {}): Promise<Site[]> {
  const { limit = 25, offset = 0 } = options;
  // The 'sites' endpoint doesn't support search, so we fetch all and filter locally.
  const allSites = await getSites(server);
  
  if (!query) {
    return allSites.slice(offset, offset + limit);
  }

  const lowerCaseQuery = query.toLowerCase();
  const filteredSites = allSites.filter(site => 
    site.name.toLowerCase().includes(lowerCaseQuery) || 
    site.ref.toLowerCase().includes(lowerCaseQuery)
  );

  return filteredSites.slice(offset, offset + limit);
}

export async function searchAccountsByName(server: ServerConfig, query?: string, options: { limit?: number, offset?: number } = {}): Promise<Account[]> {
  const { limit = 25, offset = 0 } = options;
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString()
  });

  if (query) {
    params.append('name', query);
  }
  
  const endpoint = `accounts?${params.toString()}`;
  
  const response = await callIcabbiApi({
    server,
    method: 'GET',
    endpoint,
  });

  if (response && response.body && response.body.accounts) {
    return response.body.accounts.map((acc: any) => ({
      id: acc.id,
      name: acc.name,
      ref: acc.ref,
    }));
  }

  return [];
}
