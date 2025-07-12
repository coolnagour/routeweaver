
'use server';

import type { ServerConfig } from "@/config/servers";
import type { Booking } from "@/types";

interface IcabbiApiCallOptions {
    server: ServerConfig;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    endpoint: string;
    body?: any;
}

// A simple example for a booking payload for iCabbi API
// This will likely need to be much more detailed for a real integration.
const formatBookingForIcabbi = (booking: Booking, server: ServerConfig) => {
    const customer = booking.stops.find(s => s.stopType === 'pickup');
    
    return {
        company_id: parseInt(server.companyId, 10),
        customer_name: customer?.name || 'N/A',
        customer_phone_number: customer?.phone || 'N/A',
        asap: true, // Assuming ASAP for simplicity
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
    
    const headers = new Headers({
        'Content-Type': 'application/json',
        'X-ICABBI-API-KEY': server.apiKey,
        // In a real scenario, you'd generate a signature hash using the secret key.
        // This is a placeholder for demonstration.
        'X-ICABBI-API-SIGNATURE': 'dummy-signature'
    });
    
    const options: RequestInit = {
        method,
        headers,
    };
    
    if (body) {
        options.body = JSON.stringify(body);
    }

    console.log(`Calling iCabbi API: ${method} ${url}`, options);
    
    try {
        const response = await fetch(url, options);
        
        if (!response.ok) {
            const errorBody = await response.text();
            console.error('iCabbi API Error:', response.status, errorBody);
            throw new Error(`API call failed with status ${response.status}: ${errorBody}`);
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

    // The iCabbi documentation might have a different endpoint for creating a single booking
    // or multiple bookings at once. This is an example.
    const response = await callIcabbiApi({
        server,
        method: 'POST',
        endpoint: 'bookings',
        body: payload,
    });

    return response;
}
