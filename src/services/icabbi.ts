
'use server';

import type { ServerConfig } from "@/config/servers";
import type { Booking } from "@/types";
import { createHmac } from 'crypto';

interface IcabbiApiCallOptions {
    server: ServerConfig;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    endpoint: string;
    body?: any;
}

// A simple example for a booking payload for iCabbi API
// This has been updated based on common API patterns and the available context.
const formatBookingForIcabbi = (booking: Booking, server: ServerConfig) => {
    const customer = booking.stops.find(s => s.stopType === 'pickup');
    
    return {
        company_id: parseInt(server.companyId, 10),
        customer_name: customer?.name || 'N/A',
        customer_phone_number: customer?.phone || 'N/A',
        asap: !booking.stops.some(s => s.dateTime), // If any stop has a dateTime, it's not ASAP
        prebook_time: booking.stops.find(s => s.stopType === 'pickup')?.dateTime?.toISOString(),
        stops: booking.stops.map(stop => ({
            name: stop.location.address,
            latitude: stop.location.lat,
            longitude: stop.location.lng,
            type: stop.stopType === 'pickup' ? 'P' : 'D',
            passenger_name: stop.name,
            passenger_phone: stop.phone,
            notes: stop.instructions,
        })),
    }
}


export async function callIcabbiApi({ server, method, endpoint, body }: IcabbiApiCallOptions) {
    const url = `https://${server.host}/${server.apiPath}/${endpoint}`;
    const bodyString = body ? JSON.stringify(body) : '';

    // Generate the signature as per typical iCabbi API requirements
    const signature = createHmac('sha1', server.secretKey)
        .update(url + bodyString)
        .digest('hex');
    
    const headers = new Headers({
        'Content-Type': 'application/json',
        'X-ICABBI-API-KEY': server.apiKey,
        'X-ICABBI-API-SIGNATURE': signature
    });
    
    const options: RequestInit = {
        method,
        headers,
    };
    
    if (body) {
        options.body = bodyString;
    }

    console.log(`Calling iCabbi API: ${method} ${url}`, {
        headers: {
            'X-ICABBI-API-KEY': server.apiKey,
            'X-ICABBI-API-SIGNATURE': 'REDACTED'
        },
        body: options.body
    });
    
    try {
        const response = await fetch(url, options);
        
        if (!response.ok) {
            const errorBody = await response.text();
            console.error('iCabbi API Error:', response.status, errorBody);
            throw new Error(`API call failed with status ${response.status}: ${errorBody || response.statusText}`);
        }
        
        // Handle no content response
        if (response.status === 204) {
            return null;
        }

        if (response.headers.get('content-type')?.includes('application/json')) {
            return await response.json();
        }
        
        return await response.text();

    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}

/**
 * Creates a booking using the iCabbi API.
 * Note: This is a simplified example. The actual payload will be more complex.
 */
export async function createBooking(server: ServerConfig, booking: Booking) {
    const payload = formatBookingForIcabbi(booking, server);

    const response = await callIcabbiApi({
        server,
        method: 'POST',
        endpoint: 'bookings',
        body: payload,
    });

    return response;
}
