/**
 * @fileoverview Test for the journey payload generation flow.
 * To run this test, use the command: `npm run test`
 */
import assert from 'assert';
import { generateJourneyPayload } from './journey-payload-flow';
import type { Booking, Stop } from '@/types';

function createStop(id: string, type: 'pickup' | 'dropoff', address: string, lat: number, lng: number, pickupId?: string, name?: string): Stop {
    return {
        id,
        location: { address, lat, lng },
        stopType: type,
        name: type === 'pickup' ? name || `Passenger ${id}` : undefined,
        phone: '555-1234',
        instructions: '',
        pickupStopId: pickupId,
        bookingSegmentId: parseInt(id.replace('s', ''), 10) + 1000,
    };
}

async function runTest() {
    console.log("--- Running Journey Payload Logic Test ---");

    // SCENARIO: P1 -> P2 -> D1 -> D2
    // P1: Downtown
    // P2: Uptown (closer to P1 than D1 is)
    // D1: Suburb (far from P1)
    // D2: Airport (far from all)
    const p1 = createStop('s1', 'pickup', 'Downtown', 40.7128, -74.0060, undefined, 'Alice');
    const d1 = createStop('s2', 'dropoff', 'Suburb', 40.9128, -74.1060, 's1');

    const p2 = createStop('s3', 'pickup', 'Uptown', 40.8128, -74.0060, undefined, 'Bob');
    const d2 = createStop('s4', 'dropoff', 'Airport', 40.6413, -73.7781, 's3');
    
    const booking1: Booking = {
        id: 'b1',
        stops: [p1, d1],
        bookingServerId: 101,
        requestId: 201,
    };

    const booking2: Booking = {
        id: 'b2',
        stops: [p2, d2],
        bookingServerId: 102,
        requestId: 202,
    };

    const input = {
        bookings: [booking1, booking2],
        journeyServerId: undefined
    };

    console.log("Input Bookings:");
    console.log("Booking 1:", booking1.stops.map(s => `${s.stopType} at ${s.location.address}`));
    console.log("Booking 2:", booking2.stops.map(s => `${s.stopType} at ${s.location.address}`));
    
    // The flow expects dateTime properties to be Date objects, let's ensure they are for sanitizedBookings
    const sanitizedInput = {
        ...input,
        bookings: input.bookings.map(b => ({
            ...b,
            stops: b.stops.map(s => ({
                ...s,
                dateTime: s.dateTime ? new Date(s.dateTime) : (s.stopType === 'pickup' ? new Date() : undefined)
            }))
        }))
    };

    try {
        const result = await generateJourneyPayload(sanitizedInput);
        const orderedStopIds = result.orderedStops.map(s => s.id);

        console.log("\nActual ordered stop IDs:", orderedStopIds);
        const expectedOrder = ['s1', 's3', 's2', 's4']; // P1 -> P2 -> D1 -> D2
        console.log("Expected ordered stop IDs:", expectedOrder);

        assert.deepStrictEqual(orderedStopIds, expectedOrder, `Test Failed: Stop order is incorrect.`);

        console.log("\n--- TEST PASSED! ---");
        console.log("The journey routing logic correctly ordered the stops based on proximity.");

    } catch (error) {
        console.error("\n--- TEST FAILED ---");
        console.error(error);
        process.exit(1); // Exit with an error code
    }
}

runTest();
