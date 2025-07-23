

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
    let url;
    // Check if the host already includes a protocol
    if (server.host.startsWith('http://') || server.host.startsWith('https://')) {
        url = `${server.host}/${server.apiPath}/${endpoint}`;
    } else {
        // Default to https if no protocol is specified
        url = `https://${server.host}/${server.apiPath}/${endpoint}`;
    }

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

    // For updates, we only want to send payment-related fields.
    const payload: any = {};
    
    if (typeof booking.price === 'number' || typeof booking.cost === 'number') {
        payload.payment = {
            price: booking.price || 0,
            cost: booking.cost || 0,
            fixed: 1,
        };
    }

    // Add split payment settings if they exist
    if (booking.splitPaymentSettings) {
        const { splitPaymentEnabled, splitPaymentType, splitPaymentValue, splitPaymentMinAmount, splitPaymentThresholdAmount, splitPaymentExtrasType, splitPaymentExtrasValue, splitPaymentTollsType, splitPaymentTollsValue, splitPaymentTipsType, splitPaymentTipsValue } = booking.splitPaymentSettings;
        payload.split_payment_settings = {
            split_payment_enabled: splitPaymentEnabled ? 1 : 0,
            split_payment_type: splitPaymentType,
            split_payment_value: splitPaymentValue?.toString(),
            split_payment_min_amount: splitPaymentMinAmount?.toString(),
            split_payment_threshold_amount: splitPaymentThresholdAmount?.toString(),
            split_payment_extras_type: splitPaymentExtrasType,
            split_payment_extras_value: splitPaymentExtrasValue?.toString(),
            split_payment_tolls_type: splitPaymentTollsType,
            split_payment_tolls_value: splitPaymentTollsValue?.toString(),
            split_payment_tips_type: splitPaymentTipsType,
            split_payment_tips_value: splitPaymentTipsValue?.toString(),
        };
    }

    // If there is nothing to update, just return the booking as is.
    if (Object.keys(payload).length === 0) {
        console.log(`[updateBooking] No payment changes detected for booking ${booking.bookingServerId}. Skipping API call.`);
        // Mimic the structure of a successful API call for consistency in the flow.
        const existingBooking = await getBookingById(server, booking.bookingServerId);
        return { ...existingBooking, perma_id: booking.bookingServerId };
    }
    
    const response = await callIcabbiApi({
        server,
        method: 'POST',
        endpoint: `bookings/update/${booking.bookingServerId}`,
        body: payload,
    });
    
    // The update response may not contain the full booking object, so we merge it
    // with the perma_id for consistency in the journey flow.
    const permaId = response.body?.booking?.perma_id || booking.bookingServerId;
    const updatedBookingData = await getBookingById(server, permaId);
    
    return { ...updatedBookingData, perma_id: permaId };
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
