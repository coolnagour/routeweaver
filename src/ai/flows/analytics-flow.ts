
'use server';
/**
 * @fileOverview Flow for fetching analytics data for a booking.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { ServerConfigSchema } from '@/types';
import { getBookingById } from '@/services/icabbi';
import { format, differenceInCalendarDays } from 'date-fns';
import { BigQuery, type Query, type RowMetadata } from '@google-cloud/bigquery';

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

    // Check for required fields for the new query
    if (!bookingDetails.driver?.ref || !bookingDetails.booked_date || !bookingDetails.close_date) {
        return {
            bookingDetails,
            analyticsEvents: [],
        }
    }

    const driverRef = bookingDetails.driver.ref;
    // Convert ISO date strings to microseconds for BigQuery timestamp comparison
    const startDateMicros = new Date(bookingDetails.booked_date).getTime() * 1000;
    const endDateMicros = new Date(bookingDetails.close_date).getTime() * 1000;

    // Step 2: Query BigQuery for analytics events.
    const bigquery = new BigQuery();
    let allRows: RowMetadata[] = [];
    
    const baseQuery = `
      SELECT
        event_name,
        event_timestamp,
        (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'firebase_screen_class') as screen_name,
        (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_title') as page_title,
        (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location') as page_location,
        (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') as session_id,
        user_properties
      FROM
        \`icabbitest-d22b9.analytics_171872045.{{TABLE_NAME}}\`
      WHERE
        -- (SELECT value.string_value FROM UNNEST(user_properties) WHERE key = 'BOOKING_ID') = @bookingId
        -- OR (SELECT value.string_value FROM UNNEST(user_properties) WHERE key = 'BOOKING_ID') = @tripId
        -- OR (SELECT value.string_value FROM UNNEST(user_properties) WHERE key = 'REQUEST_ID') = @tripId
        (SELECT value.string_value FROM UNNEST(user_properties) WHERE key = 'DRIVER_ID') = @driverRef
        AND event_timestamp BETWEEN @startDateMicros AND @endDateMicros
    `;

    const now = new Date();
    const daysDifference = differenceInCalendarDays(now, bookingDate);
    
    const queryOptions: Query = {
      params: { 
          driverRef: driverRef,
          startDateMicros: startDateMicros,
          endDateMicros: endDateMicros,
       },
    };
 
    if (daysDifference <= 1) {
      // For today or yesterday, prioritize the intraday table.
      const intradayQuery = baseQuery.replace('{{TABLE_NAME}}', `events_intraday_${formattedDate}`);
      console.log(`[Analytics Flow] Attempting to query recent table: ${intradayQuery}`);
      try {
        const [intradayRows] = await bigquery.query({ ...queryOptions, query: intradayQuery });
        allRows = intradayRows;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        if (errorMessage.includes('Not found: Table')) {
          console.warn(`[Analytics Flow] Intraday table for date ${formattedDate} not found. Falling back to historical table.`);
          // Fallback to historical table if intraday is not found
          const historicalQuery = baseQuery.replace('{{TABLE_NAME}}', `events_${formattedDate}`);
          console.log(`[Analytics Flow] Querying historical table as fallback: ${historicalQuery}`);
          try {
              const [historicalRows] = await bigquery.query({ ...queryOptions, query: historicalQuery });
              allRows = historicalRows;
          } catch (fallbackErr) {
              const fallbackErrorMessage = fallbackErr instanceof Error ? fallbackErr.message : 'An unknown error occurred.';
               if (fallbackErrorMessage.includes('Not found: Table')) {
                    console.warn(`[Analytics Flow] Fallback historical table for date ${formattedDate} was also not found. This is expected if no events occurred.`);
               } else {
                   console.error("BigQuery historical fallback query failed:", fallbackErr);
                   throw new Error(`Failed to query BigQuery historical table. Error: ${fallbackErrorMessage}`);
               }
          }
        } else {
            console.error("BigQuery intraday query failed:", err);
            throw new Error(`Failed to query BigQuery intraday table. Error: ${errorMessage}`);
        }
      }
    } else {
      // For older dates, query only the historical table.
      const historicalQuery = baseQuery.replace('{{TABLE_NAME}}', `events_${formattedDate}`);
      console.log(`[Analytics Flow] Querying historical table: ${historicalQuery}`);
      try {
        const [historicalRows] = await bigquery.query({ ...queryOptions, query: historicalQuery });
        allRows = historicalRows;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        if (errorMessage.includes('Not found: Table')) {
             console.warn(`[Analytics Flow] Historical table for date ${formattedDate} was not found. This is expected if no events occurred.`);
        } else {
            console.error("BigQuery historical query failed:", err);
            throw new Error(`Failed to query BigQuery historical table. Error: ${errorMessage}`);
        }
      }
    }

    // Process the rows from the successful query and sort by timestamp.
    const analyticsEvents = allRows.map(row => ({
      name: row.event_name,
      timestamp: new Date(row.event_timestamp / 1000).toISOString(), // Convert microseconds to ISO string
      params: {
        screen_name: row.screen_name,
        page_title: row.page_title,
        page_location: row.page_location,
        session_id: row.session_id,
        user_properties: row.user_properties,
      }
    })).sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Step 3: Return the combined data.
    return {
      bookingDetails,
      analyticsEvents,
    };
  }
);
