
import type { Booking, ServerConfig } from "@/types";
import parsePhoneNumberFromString from 'libphonenumber-js';

/**
 * @fileOverview A shared utility to format booking data for the API.
 */

export const formatBookingForApi = (booking: Booking, server: ServerConfig) => {
    if (booking.stops.length < 2) {
        throw new Error("Booking must have at least a pickup and a dropoff stop.");
    }
    
    const firstStop = booking.stops[0];
    if (firstStop.stopType !== 'pickup') {
        throw new Error("The first stop must be a pickup.");
    }
    
    if (!booking.siteId) {
        throw new Error("Site ID is required for booking.");
    }
    
    if (!booking.accountId) {
        throw new Error("Account ID is required for booking.");
    }

    const lastStop = booking.stops[booking.stops.length - 1];
    const viaStops = booking.stops.slice(1, -1);
    
    const defaultCountry = server.countryCodes?.[0]?.toUpperCase() as any;
    
    const payload: any = {
        date: firstStop.dateTime?.toISOString() || new Date().toISOString(),
        source: "DISPATCH",
        name: firstStop.name || 'N/A',
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
        account_id: booking.accountId,
        site_id: booking.siteId,
        customer_id: booking.customerId,
        external_booking_id: booking.externalBookingId,
        vehicle_type: booking.vehicleType,
        external_area_code: booking.externalAreaCode,
        with_bookingsegments: true,
    };

    if (viaStops.length > 0) {
        payload.vias = viaStops.map(stop => ({
            lat: stop.location.lat.toString(),
            lng: stop.location.lng.toString(),
            formatted: stop.location.address,
            driver_instructions: stop.instructions || "",
        }));
    }
    
    // Use the phone number from the first stop (primary passenger).
    if (firstStop.phone) {
        const phoneNumber = parsePhoneNumberFromString(firstStop.phone, defaultCountry);
        if (phoneNumber && phoneNumber.isValid()) {
            payload.phone = phoneNumber.number;
        } else {
             console.warn(`Invalid phone number provided: ${firstStop.phone}. It will be omitted from the API call.`);
        }
    }

    if ((booking.price && booking.price > 0) || (booking.cost && booking.cost > 0)) {
        payload.payment = {
            price: booking.price || 0,
            cost: booking.cost || 0,
            fixed: 1,
        };
    }
    
    // Add booking-level instructions to the payload root
    if (booking.instructions) {
        payload.instructions = booking.instructions;
    }

    return payload;
};
