

'use server';

import type { ServerConfig } from "@/types";
import type { Booking, Account, Site, AccountField, Extra, Stop } from "@/types";
import { formatBookingForApi } from "@/lib/booking-formatter";
import parsePhoneNumberFromString, { getCountryCallingCode } from 'libphonenumber-js';


interface IcabbiApiCallOptions {
    server: ServerConfig;
    method: 'GET' | 'POST' | 'DELETE';
    endpoint: string;
    body?: any;
    headers?: Record<string, string>;
}

export async function callIcabbiApi({ server, method, endpoint, body, headers: customHeaders }: IcabbiApiCallOptions) {
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
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': 'Basic ' + Buffer.from(`${server.appKey}:${server.secretKey}`).toString('base64'),
        ...customHeaders, // Custom headers will override defaults
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
            let errorMessage = `API call failed with status ${response.status}: ${responseText || response.statusText}`;
            try {
                const errorJson = JSON.parse(responseText);
                if (errorJson.message) {
                    errorMessage = errorJson.message;
                }
                if (errorJson.body && typeof errorJson.body === 'object') {
                    const details = Object.entries(errorJson.body).map(([key, value]) => `${key}: ${value}`).join(', ');
                    if (details) {
                        errorMessage += ` - ${details}`;
                    }
                }
            } catch (e) {
                // responseText was not valid JSON, stick with the original error
            }

            throw new Error(errorMessage);
        }
        
        if (response.status === 204 || !responseText) {
            return null;
        }

        const jsonResponse = JSON.parse(responseText);

        if (jsonResponse.status && jsonResponse.status.type === 'error' || jsonResponse.error) {
            let errorMessage = jsonResponse.message || (jsonResponse.status && jsonResponse.status.message) || 'Unknown API error';
            
            // Check for detailed error messages in the body, which can be an object or a string
            if (jsonResponse.body) {
                if (typeof jsonResponse.body === 'object' && Object.keys(jsonResponse.body).length > 0) {
                    const details = Object.entries(jsonResponse.body).map(([key, value]) => `${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`).join(', ');
                    errorMessage += ` - ${details}`;
                } else if (typeof jsonResponse.body === 'string') {
                    errorMessage += ` - ${jsonResponse.body}`;
                }
            }
            
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
    fetchOnly?: boolean;
    originalBooking?: Booking;
}

export async function createBooking(server: ServerConfig, { booking, siteId, accountId, fetchOnly = false }: BookingApiContext) {
    const payload = formatBookingForApi({ booking, server, siteId, accountId });
    
    // In some cases (like an unmodified booking in a journey), we just need the server representation
    // of the booking to get segment IDs, but we don't want to actually create it again.
    // The `bookings/add` endpoint with `test_mode=1` can simulate this.
    const endpoint = fetchOnly ? 'bookings/add?test_mode=1' : 'bookings/add';

    const response = await callIcabbiApi({
        server,
        method: 'POST',
        endpoint: endpoint,
        body: payload,
        headers: {
            phone: payload.phone,
        }
    });
    
    return response.body.booking;
}

export async function updateBooking(server: ServerConfig, { booking, originalBooking }: BookingApiContext) {
    if (!booking.bookingServerId) {
        throw new Error("Booking must have a bookingServerId to be updated.");
    }
    
    const payload: any = {};
    const originalStops = originalBooking?.stops.sort((a,b) => a.order - b.order) || [];
    const updatedStops = booking.stops.sort((a,b) => a.order - b.order);

    const originalDestination = originalStops[originalStops.length - 1];
    const updatedDestination = updatedStops[updatedStops.length - 1];

    if (updatedDestination?.location?.address && updatedDestination.location.address !== originalDestination?.location?.address) {
        console.log(`[updateBooking] Destination change detected. Old: "${originalDestination?.location?.address}", New: "${updatedDestination.location.address}"`);
        payload.destination = {
            lat: updatedDestination.location.lat.toString(),
            lng: updatedDestination.location.lng.toString(),
            formatted: updatedDestination.location.address,
            driver_instructions: updatedDestination.instructions || "",
        };
    }

    const originalFirstPickup = originalStops.find(s => s.stopType === 'pickup');
    const updatedFirstPickup = updatedStops.find(s => s.stopType === 'pickup');
    
    const originalTime = originalFirstPickup?.dateTime ? new Date(originalFirstPickup.dateTime).getTime() : 0;
    const updatedTime = updatedFirstPickup?.dateTime ? new Date(updatedFirstPickup.dateTime).getTime() : 0;
    
    if (updatedTime !== originalTime) {
        console.log(`[updateBooking] Date change detected.`);
        if (updatedFirstPickup?.dateTime) {
            payload.date = updatedFirstPickup.dateTime.toISOString();
        }
    }


    if (typeof booking.price === 'number' || typeof booking.cost === 'number') {
        payload.payment = {
            price: booking.price ?? 0,
            cost: booking.cost ?? 0,
            fixed: 1,
        };
    }

    if (booking.splitPaymentSettings?.splitPaymentEnabled) {
        const { splitPaymentEnabled, ...settings } = booking.splitPaymentSettings;
        payload.split_payment_settings = {
            split_payment_enabled: splitPaymentEnabled ? 1 : 0,
            ...settings,
        };
    }
    
    if (booking.metadata && booking.metadata.length > 0) {
        payload.app_metadata = booking.metadata.reduce((acc, item) => {
            if (item.key) { acc[item.key] = item.value; }
            return acc;
        }, {} as Record<string, string>);
    }

    if (booking.extras_config && booking.extras_config.length > 0) {
        payload.extras_config = booking.extras_config.map(extra => ({
            id: extra.extraId,
            quantity: extra.quantity,
        }));
    }
    
    if (typeof booking.pobPayment === 'boolean') {
        payload.pob_payment = booking.pobPayment ? 1 : 0;
    }

    if (Object.keys(payload).length === 0) {
        console.log(`[updateBooking] No changes detected for booking ${booking.bookingServerId}. Skipping API call.`);
        const existingBooking = await getBookingById(server, booking.bookingServerId);
        return { ...existingBooking, perma_id: booking.bookingServerId };
    }

    const firstPickupForHeader = booking.stops.find(s => s.stopType === 'pickup');
    const defaultCountry = server.countryCodes?.[0]?.toUpperCase() as any;
    let phoneForHeader = '';

    if (firstPickupForHeader?.phone) {
        const phoneNumber = parsePhoneNumberFromString(firstPickupForHeader.phone, defaultCountry);
        if (phoneNumber && phoneNumber.isValid()) {
            phoneForHeader = phoneNumber.number as string;
        }
    }
    
    if (!phoneForHeader) {
        const countryCode = getCountryCallingCode(defaultCountry);
        phoneForHeader = `+${countryCode}0000000000`.slice(0, 15);
    }

    const response = await callIcabbiApi({
        server,
        method: 'POST',
        endpoint: `bookings/update/${booking.bookingServerId}`,
        body: payload,
        headers: { phone: phoneForHeader }
    });
    
    const permaId = response.body?.booking?.perma_id || booking.bookingServerId;
    const updatedBookingData = await getBookingById(server, permaId);
    
    return { ...updatedBookingData, perma_id: permaId };
}


export async function getBookingById(server: ServerConfig, permaId: number) {
    const defaultCountry = server.countryCodes?.[0]?.toUpperCase() as any;
    const countryCode = getCountryCallingCode(defaultCountry);
    const placeholderPhone = `+${countryCode}0000000000`.slice(0, 15);

    const response = await callIcabbiApi({
        server,
        method: 'GET',
        endpoint: `bookings/index/${permaId}`,
        headers: {
            phone: placeholderPhone
        }
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

export async function getJourneyById(server: ServerConfig, journeyId: number) {
    const response = await callIcabbiApi({
        server,
        method: 'POST',
        endpoint: 'journey/get',
        body: { journey_id: journeyId },
    });
    
    // The journey status is nested within the response.
    if (response && response.body && response.body.journeys && response.body.journeys.length > 0) {
        const journeyData = response.body.journeys[0]?.[0];
        if (journeyData && journeyData.status) {
            return { status: journeyData.status };
        }
    }

    return null;
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

export async function sendMessage(server: ServerConfig, id: number, type: 'journey' | 'booking', body: string) {
    const payload = {
        conversationable_id: id,
        conversationable_type: type,
        body: body,
    };

    const response = await callIcabbiApi({
        server,
        method: 'POST',
        endpoint: 'messages/send',
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
      account_fields: acc.account_fields ? acc.account_fields.map((field: any): AccountField => ({
          id: field.id,
          title: field.title,
          type: field.type,
          required: field.required,
          active: field.active,
          description: field.description,
          regex: field.regex,
          values: field.values,
      })) : [],
    }));
  }

  return [];
}

export async function getDriverByRef(server: ServerConfig, ref: string) {
    const response = await callIcabbiApi({
        server,
        method: 'GET',
        endpoint: `drivers/id?ref=${ref}`,
    });

    if (response && response.body) {
        return response.body;
    }
    return null;
}

export async function dispatchBooking(server: ServerConfig, tripId: string, driverId: string) {
    const payload = {
        trip_id: tripId,
        driver_id: driverId,
        allow_decline: true,
        enable_active_queue: true,
    };
    
    const response = await callIcabbiApi({
        server,
        method: 'POST',
        endpoint: 'bookings/dispatchbooking',
        body: payload,
    });
    
    return response;
}

export async function getExtras(server: ServerConfig): Promise<Extra[]> {
    const response = await callIcabbiApi({
        server,
        method: 'GET',
        endpoint: 'extras/index',
    });

    if (response && response.body && response.body.extras) {
        return response.body.extras.map((extra: any) => ({
            id: extra.id,
            name: extra.name,
            value: extra.value,
            editable: extra.editable,
        }));
    }

    return [];
}
