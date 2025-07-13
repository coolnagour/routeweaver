
'use server';

import type { ServerConfig } from "@/config/servers";
import type { Booking, Account } from "@/types";
import parsePhoneNumberFromString from 'libphonenumber-js';

interface IcabbiApiCallOptions {
    server: ServerConfig;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    endpoint: string;
    body?: any;
}

const formatBookingForIcabbi = (booking: Booking, server: ServerConfig) => {
    if (booking.stops.length < 2) {
        throw new Error("Booking must have at least a pickup and a dropoff stop.");
    }
    const pickupStop = booking.stops.find(s => s.stopType === 'pickup');
    if (!pickupStop) {
        throw new Error("Booking must contain at least one pickup stop.");
    }
    
    if (!booking.siteId) {
        throw new Error("Site ID is required for booking.");
    }
    
    if (!booking.accountId) {
        throw new Error("Account ID is required for booking.");
    }

    const firstStop = booking.stops[0];
    const lastStop = booking.stops[booking.stops.length - 1];
    const viaStops = booking.stops.slice(1, -1);

    let formattedPhone = 'N/A';
    if (pickupStop.phone) {
        // libphonenumber-js can handle various formats, including those with hyphens
        const defaultCountry = server.countryCodes?.[0]?.toUpperCase() as any;
        const phoneNumber = parsePhoneNumberFromString(pickupStop.phone, defaultCountry);
        
        // Only use the number if the library considers it valid
        if (phoneNumber && phoneNumber.isValid()) {
            // .number property already gives the E.164 formatted string (e.g., "+353...")
            formattedPhone = phoneNumber.number;
        }
    }


    return {
        date: pickupStop.dateTime?.toISOString() || new Date().toISOString(),
        source: "DISPATCH",
        name: pickupStop.name || 'N/A',
        phone: formattedPhone,
        address: {
            lat: firstStop.location.lat.toString(),
            lng: firstStop.location.lng.toString(),
            formatted: firstStop.location.address,
            driver_instructions: firstStop.instructions || "",
        },
        destination: {
            lat: lastStop.location.lat.toString(),
            lng: lastStop.location.lng.toString(),
            formatted: lastStop.location.address,
            driver_instructions: lastStop.instructions || "",
        },
        vias: viaStops.map(stop => ({
            lat: stop.location.lat.toString(),
            lng: stop.location.lng.toString(),
            formatted: stop.location.address,
            driver_instructions: stop.instructions || "",
        })),
        account_id: booking.accountId,
        site_id: booking.siteId,
        with_bookingsegments: true,
    };
};

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

export async function createBooking(server: ServerConfig, booking: Booking) {
    const payload = formatBookingForIcabbi(booking, server);

    const response = await callIcabbiApi({
        server,
        method: 'POST',
        endpoint: 'bookings/add',
        body: payload,
    });
    
    return response.body.booking;
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

export async function searchAccountsByName(server: ServerConfig, query: string, options: { limit?: number, offset?: number } = {}): Promise<Account[]> {
  const { limit = 25, offset = 0 } = options;
  const params = new URLSearchParams({
    name: query,
    limit: limit.toString(),
    offset: offset.toString()
  });
  
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
    
