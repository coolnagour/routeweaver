
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
        // Only dropoffs should have a pickupStopId
        pickupStopId: type === 'dropoff' ? pickupId : undefined,
        // Assign arbitrary but unique segment IDs for testing purposes
        bookingSegmentId: parseInt(id.replace('s', ''), 10) + 1000,
    };
}

async function runTest() {
    console.log("--- Running Journey Payload Logic Test ---");

    // SCENARIO: P1 -> P2 -> D1 -> D2
    const p1 = createStop('s1', 'pickup', 'Terminal Rd S, North Wall, Dublin, Ireland', 53.3479056, -6.1954911, undefined, 'Robert Smith');
    const p2 = createStop('s3', 'pickup', 'Sutton Cross, Burrow, Dublin, Ireland', 53.3899572, -6.109947, undefined, 'John Smith');
    
    // Both passengers are going to the same location
    const dropoffAddress = 'Howth Rd, Dublin, Ireland';
    const dropoffLat = 53.3762177;
    const dropoffLng = -6.188735299999999;
    
    const d1 = createStop('s2', 'dropoff', dropoffAddress, dropoffLat, dropoffLng, 's1');
    const d2 = createStop('s4', 'dropoff', dropoffAddress, dropoffLat, dropoffLng, 's3');
    
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
    console.log("Booking 1 (Robert):", booking1.stops.map(s => `${s.stopType} at ${s.location.address}`));
    console.log("Booking 2 (John):", booking2.stops.map(s => `${s.stopType} at ${s.location.address}`));
    
    
    try {
        // Convert the Date object back to an ISO string for the schema validation
        const inputForFlow = {
            ...input,
            bookings: input.bookings.map(b => ({
                ...b,
                stops: b.stops.map((s: any) => ({
                    ...s,
                    dateTime: s.dateTime ? s.dateTime.toISOString() : undefined
                }))
            }))
        };
        const result = await generateJourneyPayload(inputForFlow);
        const orderedStopIds = result.orderedStops.map(s => s.id);

        // Expected order: P1 -> P2 -> D1 -> D2. 
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
