
import type { Booking, ServerConfig } from "@/types";
import parsePhoneNumberFromString from 'libphonenumber-js';

/**
 * @fileOverview A shared utility to format booking data for the API.
 */

export const formatBookingForApi = (booking: Booking, server: ServerConfig) => {
    // Ensure stops are sorted by the order field before processing
    const sortedStops = [...booking.stops].sort((a, b) => a.order - b.order);

    if (sortedStops.length < 2) {
        throw new Error("Booking must have at least a pickup and a dropoff stop.");
    }
    
    const firstPickup = sortedStops.find(s => s.stopType === 'pickup');
    if (!firstPickup) {
        throw new Error("Booking must have at least one pickup stop.");
    }
    
    if (!booking.siteId) {
        throw new Error("Site ID is required for booking.");
    }
    
    if (!booking.accountId) {
        throw new Error("Account ID is required for booking.");
    }

    const lastStop = sortedStops[sortedStops.length - 1];
    const viaStops = sortedStops.slice(1, -1);
    
    const defaultCountry = server.countryCodes?.[0]?.toUpperCase() as any;
    
    const payload: any = {
        date: firstPickup.dateTime?.toISOString() || new Date().toISOString(),
        source: "DISPATCH",
        name: firstPickup.name || 'N/A',
        address: {
            lat: firstPickup.location.lat.toString(),
            lng: firstPickup.location.lng.toString(),
            formatted: firstPickup.location.address,
            driver_instructions: firstPickup.instructions || "",
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
    
    // Use the phone number from the first pickup stop (primary passenger).
    if (firstPickup.phone) {
        const phoneNumber = parsePhoneNumberFromString(firstPickup.phone, defaultCountry);
        if (phoneNumber && phoneNumber.isValid()) {
            payload.phone = phoneNumber.number;
        } else {
             console.warn(`Invalid phone number provided: ${firstPickup.phone}. It will be omitted from the API call.`);
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
