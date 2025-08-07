
'use server';
/**
 * @fileOverview Flow for fetching analytics data for a booking.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { ServerConfigSchema } from '@/types';
import { getBookingById } from '@/services/icabbi';
import { format } from 'date-fns';
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

    // !!! IMPORTANT !!!
    // Replace `your_analytics_project.your_dataset` with your actual 
    // BigQuery project ID and Firebase Analytics dataset name (e.g., analytics_123456789).
    const query = `
      SELECT
        event_name,
        event_timestamp,
        (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'firebase_screen_class') as screen_name,
        (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_title') as page_title,
        (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location') as page_location,
        (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') as session_id
      FROM
        \`your_analytics_project.your_dataset.events_${formattedDate}\`
      WHERE
        (SELECT value.string_value FROM UNNEST(user_properties) WHERE key = 'BOOKING_ID') = @bookingId
      ORDER BY
        event_timestamp;
    `;
    
    const options = {
      query: query,
      params: { bookingId: bookingId },
    };

    console.log(`[Analytics Flow] Querying BigQuery for BOOKING_ID = ${bookingId}`);
    
    let analyticsEvents: AnalyticsEvent[];
    try {
        const [rows] = await bigquery.query(options);
        analyticsEvents = rows.map(row => ({
          name: row.event_name,
          timestamp: new Date(row.event_timestamp / 1000).toISOString(), // Convert microseconds to ISO string
          params: {
            screen_name: row.screen_name,
            page_title: row.page_title,
            page_location: row.page_location,
            session_id: row.session_id,
          }
        }));
    } catch (err) {
        console.error("BigQuery query failed:", err);
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        throw new Error(`Failed to query BigQuery. Please ensure your project/dataset is correct and you have permissions. Error: ${errorMessage}`);
    }

    // Step 3: Return the combined data.
    return {
      bookingDetails,
      analyticsEvents,
    };
  }
);
