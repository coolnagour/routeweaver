

import type { Booking, ServerConfig } from "@/types";
import parsePhoneNumberFromString, { getCountryCallingCode } from 'libphonenumber-js';

/**
 * @fileOverview A shared utility to format booking data for the API.
 */

// Define a new type for the function parameters to include site and account context
type BookingWithApiContext = {
    booking: Booking;
    server: ServerConfig;
    siteId: number;
    accountId: number;
};

export const formatBookingForApi = ({ booking, server, siteId, accountId }: BookingWithApiContext) => {
    // Ensure stops are sorted by the order field before processing
    const sortedStops = [...booking.stops].sort((a, b) => a.order - b.order);

    if (sortedStops.length === 0) {
        throw new Error("Booking must have at least one stop.");
    }
    if (sortedStops.length < 2 && !booking.holdOn) {
        throw new Error("Booking must have at least a pickup and a dropoff stop.");
    }

    const firstPickup = sortedStops.find(s => s.stopType === 'pickup');
    if (!firstPickup) {
        throw new Error("Booking must have at least one pickup stop.");
    }
    
    if (!siteId) {
        throw new Error("Site ID is required for booking.");
    }
    
    if (!accountId) {
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
        // For hold on, destination is "As Directed". For regular, it's the last stop.
        destination: {
            lat: lastStop.location.lat.toString(),
            lng: lastStop.location.lng.toString(),
            formatted: booking.holdOn ? "As Directed" : lastStop.location.address,
            driver_instructions: lastStop.instructions || "",
        },
        account_id: accountId,
        site_id: siteId,
        customer_id: booking.customerId,
        external_booking_id: booking.externalBookingId,
        vehicle_type: booking.vehicleType,
        external_area_code: booking.externalAreaCode,
        with_bookingsegments: true,
    };

    if (viaStops.length > 0 && !booking.holdOn) {
        payload.vias = viaStops.map(stop => ({
            lat: stop.location.lat.toString(),
            lng: stop.location.lng.toString(),
            formatted: stop.location.address,
            driver_instructions: stop.instructions || "",
        }));
    }
    
    // API requires the phone field to be present. Initialize with a placeholder.
    const countryCode = getCountryCallingCode(defaultCountry);
    payload.phone = `+${countryCode}0000000000`.slice(0, 15);

    // If a valid phone number is provided, use it instead of the placeholder.
    if (firstPickup.phone && !booking.holdOn) {
        const phoneNumber = parsePhoneNumberFromString(firstPickup.phone, defaultCountry);
        if (phoneNumber && phoneNumber.isValid()) {
            payload.phone = phoneNumber.number;
        } else {
             console.warn(`Invalid phone number provided: ${firstPickup.phone}. A placeholder will be used.`);
        }
    }

    if (typeof booking.price === 'number' || typeof booking.cost === 'number') {
        payload.payment = {
            price: booking.price ?? 0,
            cost: booking.cost ?? 0,
            fixed: 1,
        };
    }
    
    // Add booking-level instructions to the payload root
    if (booking.instructions) {
        payload.instructions = booking.instructions;
    }

    // Add split payment settings if enabled
    if (booking.splitPaymentSettings?.splitPaymentEnabled) {
        const { splitPaymentEnabled, splitPaymentType, splitPaymentValue, splitPaymentMinAmount, splitPaymentThresholdAmount, splitPaymentExtrasType, splitPaymentExtrasValue, splitPaymentTollsType, splitPaymentTollsValue, splitPaymentTipsType, splitPaymentTipsValue } = booking.splitPaymentSettings;
        payload.split_payment_settings = {
            split_payment_enabled: 1,
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
    
    // Add metadata if it exists
    if (booking.metadata && booking.metadata.length > 0) {
        payload.app_metadata = booking.metadata.reduce((acc, item) => {
            if (item.key) { // Ensure key is not empty
                acc[item.key] = item.value;
            }
            return acc;
        }, {} as Record<string, string>);
    }


    return payload;
};
