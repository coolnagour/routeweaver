
'use server';

import type { ServerConfig } from "@/config/servers";
import type { Booking, Account } from "@/types";

interface IcabbiApiCallOptions {
    server: ServerConfig;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    endpoint: string;
    body?: any;
}

const formatBookingForIcabbi = (booking: Booking, server: ServerConfig) => {
    const pickupStop = booking.stops.find(s => s.stopType === 'pickup');
    // In this new model, we assume a simple 1 pickup, 1 dropoff booking.
    const dropoffStop = booking.stops.find(s => s.stopType === 'dropoff');

    if (!pickupStop || !dropoffStop) {
        throw new Error("Booking must have at least one pickup and one dropoff stop.");
    }
    
    if (!booking.siteId) {
        throw new Error("Site ID is required for booking.");
    }
    
    if (!booking.accountId) {
        throw new Error("Account ID is required for booking.");
    }

    return {
        date: pickupStop.dateTime?.toISOString() || new Date().toISOString(),
        source: "DISPATCH",
        name: pickupStop.name || 'N/A',
        phone: pickupStop.phone || 'N/A',
        customer_id: "123", // Example customer_id
        address: {
            lat: pickupStop.location.lat.toString(),
            lng: pickupStop.location.lng.toString(),
            formatted: pickupStop.location.address,
            driver_instructions: pickupStop.instructions || "",
        },
        destination: {
            lat: dropoffStop.location.lat.toString(),
            lng: dropoffStop.location.lng.toString(),
            formatted: dropoffStop.location.address,
            driver_instructions: dropoffStop.instructions || "",
        },
        account_id: booking.accountId,
        site_id: booking.siteId,
        with_bookingsegments: true,
    };
};

export async function callIcabbiApi({ server, method, endpoint, body }: IcabbiApiCallOptions) {
    const url = `https://${server.host}/${server.apiPath}/${endpoint}?app_key=${server.appKey}`;
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
        // Only log body for non-204 responses
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

/**
 * Creates a booking using the iCabbi API.
 */
export async function createBooking(server: ServerConfig, booking: Booking) {
    const payload = formatBookingForIcabbi(booking, server);

    const response = await callIcabbiApi({
        server,
        method: 'POST',
        endpoint: 'bookings/add',
        body: payload,
    });
    
    // The script expects the nested 'booking' object
    return response.body.booking;
}

/**
 * Creates a journey by linking existing booking segments.
 */
export async function createJourney(server: ServerConfig, journeyPayload: any) {
    const response = await callIcabbiApi({
        server,
        method: 'POST',
        endpoint: 'journey/update',
        body: journeyPayload,
    });

    return response.body;
}

/**
 * Fetches available sites from the iCabbi API.
 */
export async function getSites(server: ServerConfig): Promise<{ id: number, name: string, ref: string }[]> {
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

/**
 * Fetches a page of accounts.
 */
export async function getAccountsByPage(server: ServerConfig, limit: number, offset: number): Promise<Account[]> {
  const endpoint = `accounts?limit=${limit}&offset=${offset}`;
  
  const response = await callIcabbiApi({
    server,
    method: 'GET',
    endpoint,
  });

  if (response && response.body && response.body.accounts) {
    return response.body.accounts.map((acc: any) => ({
      id: acc.id,
      name: acc.name,
      number: acc.account_no, // The API doc suggests account_no is not available here. Let's use `ref` as a fallback.
      ref: acc.ref,
    }));
  }

  return [];
}
    