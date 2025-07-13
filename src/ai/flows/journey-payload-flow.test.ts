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
        // Assign arbitrary but unique segment IDs for testing purposes
        bookingSegmentId: parseInt(id.replace('s', ''), 10) + 1000, 
    };
}

async function runTest() {
    console.log("--- Running Journey Payload Logic Test ---");

    // SCENARIO: P1 -> P2 -> D1 & D2 (Same Location)
    // P1 (s1): Downtown (Start)
    // P2 (s3): Uptown (closest next stop to P1)
    // D1 (s2) & D2 (s4) are at the same location: Office Complex
    const p1 = createStop('s1', 'pickup', 'Downtown', 40.7128, -74.0060, undefined, 'Alice');
    const d1 = createStop('s2', 'dropoff', 'Office Complex', 40.8528, -74.0560, 's1');

    const p2 = createStop('s3', 'pickup', 'Uptown', 40.8128, -74.0060, undefined, 'Bob');
    // s4 is the same dropoff location as s2
    const d2 = createStop('s4', 'dropoff', 'Office Complex', 40.8528, -74.0560, 's3');
    
    const booking1: Booking = {
        id: 'b1',
        stops: [p1, d1],
        bookingServerId: 101,
        requestId: 201, // Final stop of this booking uses this ID
    };

    const booking2: Booking = {
        id: 'b2',
        stops: [p2, d2],
        bookingServerId: 102,
        requestId: 202, // Final stop of this booking uses this ID
    };

    const input = {
        bookings: [booking1, booking2],
        journeyServerId: undefined
    };

    console.log("Input Bookings:");
    console.log("Booking 1 (Alice):", booking1.stops.map(s => `${s.stopType} at ${s.location.address}`));
    console.log("Booking 2 (Bob):", booking2.stops.map(s => `${s.stopType} at ${s.location.address}`));
    
    // The flow expects dateTime properties to be Date objects.
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

        // Expected order: P1 -> P2 -> D1 -> D2. D1 and D2 are at the same location.
        // The algorithm should pick one of them after P2, then the other one with 0 distance.
        // The exact order of D1 vs D2 might not matter if they are co-located, but this is a stable expectation.
        const expectedOrder = ['s1', 's3', 's2', 's4']; 
        console.log("\nActual ordered stop IDs:", orderedStopIds);
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
