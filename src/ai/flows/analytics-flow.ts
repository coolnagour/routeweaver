
'use server';
/**
 * @fileOverview Flow for fetching analytics data for a booking.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { ServerConfigSchema } from '@/types';
import { getBookingById } from '@/services/icabbi';
import { format, isToday } from 'date-fns';
import { BigQuery } from '@google-cloud/bigquery';

const AnalyticsInputSchema = z.object({
  bookingId: z.string(),
  server: ServerConfigSchema,
});
export type AnalyticsInput = z.infer<typeof AnalyticsInputSchema>;

const AnalyticsEventSchema = z.object({
  name: z.string(),
  timestamp: z.string(),
  params: z.record(z.any()),
});
export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;

const AnalyticsOutputSchema = z.object({
  bookingDetails: z.record(z.any()),
  analyticsEvents: z.array(AnalyticsEventSchema),
});
export type AnalyticsOutput = z.infer<typeof AnalyticsOutputSchema>;

export async function getAnalyticsForBooking(input: AnalyticsInput): Promise<AnalyticsOutput> {
  return await getAnalyticsForBookingFlow(input);
}

const getAnalyticsForBookingFlow = ai.defineFlow(
  {
    name: 'getAnalyticsForBookingFlow',
    inputSchema: AnalyticsInputSchema,
    outputSchema: AnalyticsOutputSchema,
  },
  async ({ bookingId, server }) => {
    // Step 1: Get booking details from iCabbi API to find the date
    const bookingDetails = await getBookingById(server, parseInt(bookingId));
    
    if (!bookingDetails || !bookingDetails.date) {
      throw new Error(`Booking with ID ${bookingId} not found or has no date.`);
    }

    const bookingDate = new Date(bookingDetails.date);
    const formattedDate = format(bookingDate, 'yyyyMMdd');

    // Step 2: Query BigQuery for analytics events.
    const bigquery = new BigQuery();

    const baseQuery = `
      SELECT
        event_name,
        event_timestamp,
        (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'firebase_screen_class') as screen_name,
        (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_title') as page_title,
        (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location') as page_location,
        (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') as session_id
      FROM
        \`icabbitest-d22b9.analytics_171872045.{{TABLE_NAME}}\`
      WHERE
        (SELECT value.string_value FROM UNNEST(user_properties) WHERE key = 'BOOKING_ID') = @bookingId
    `;

    const queries: string[] = [];
    if (isToday(bookingDate)) {
        // For today, query both intraday and the daily table, as data might be in either.
        queries.push(baseQuery.replace('{{TABLE_NAME}}', `events_intraday_${formattedDate}`));
    }
    // Always query the historical table.
    queries.push(baseQuery.replace('{{TABLE_NAME}}', `events_${formattedDate}`));
    
    const finalQuery = queries.join('\nUNION ALL\n');

    const options = {
      query: finalQuery,
      params: { bookingId: bookingId },
    };

    console.log(`[Analytics Flow] Querying BigQuery for BOOKING_ID = ${bookingId} on date ${formattedDate}`);
    console.log(`[Analytics Flow] Query: ${finalQuery}`);
    
    let analyticsEvents: AnalyticsEvent[] = [];
    try {
        const [rows] = await bigquery.query(options);
        const uniqueEvents = new Map<string, AnalyticsEvent>();
        
        rows.forEach(row => {
            const event: AnalyticsEvent = {
              name: row.event_name,
              timestamp: new Date(row.event_timestamp / 1000).toISOString(), // Convert microseconds to ISO string
              params: {
                screen_name: row.screen_name,
                page_title: row.page_title,
                page_location: row.page_location,
                session_id: row.session_id,
              }
            };
            // Use a composite key to uniquely identify an event to handle potential duplicates from UNION ALL
            const eventKey = `${event.name}-${event.timestamp}`;
            if (!uniqueEvents.has(eventKey)) {
                uniqueEvents.set(eventKey, event);
            }
        });

        analyticsEvents = Array.from(uniqueEvents.values()).sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        // If the table is not found, it's not a fatal error, just means no events for that day.
        if (errorMessage.includes('Not found: Table')) {
             console.warn(`[Analytics Flow] BigQuery table for date ${formattedDate} not found. Returning empty events list.`);
        } else {
            console.error("BigQuery query failed:", err);
            throw new Error(`Failed to query BigQuery. Please ensure your project/dataset is correct and you have permissions. Error: ${errorMessage}`);
        }
    }

    // Step 3: Return the combined data.
    return {
      bookingDetails,
      analyticsEvents,
    };
  }
);
