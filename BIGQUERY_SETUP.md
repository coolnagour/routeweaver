
# Setting Up BigQuery Authentication for Firebase Studio

This guide outlines the steps required to authenticate your local development environment and your deployed Firebase App Hosting backend to query Google BigQuery.

The application has a placeholder for BigQuery logic in `src/ai/flows/analytics-flow.ts`. You will need to implement the client library and query logic yourself.

## 1. Enable Required APIs

First, you need to enable the BigQuery API in your Google Cloud project.

1.  Go to the [Google Cloud Console API Library](https://console.cloud.google.com/apis/library).
2.  Select the Google Cloud project associated with your Firebase project.
3.  Search for "BigQuery API" and click **Enable**.
4.  Search for "IAM Service Account Credentials API" and click **Enable**.

## 2. Create a Service Account

A service account is a special type of Google account intended to represent a non-human user that needs to authenticate and be authorized to access data in Google APIs.

1.  Go to the [Service Accounts page](https://console.cloud.google.com/iam-admin/serviceaccounts) in the Google Cloud Console.
2.  Select your project.
3.  Click **Create service account**.
4.  Give the service account a name (e.g., `firebase-studio-analytics-reader`) and an optional description.
5.  Click **Create and Continue**.
6.  In the **Grant this service account access to project** section, add the following roles:
    *   `BigQuery Data Viewer` (to read data from BigQuery tables)
    *   `BigQuery Job User` (to run queries)
7.  Click **Continue**, then **Done**.

## 3. Configure Authentication

You need to provide credentials to your application code. This is done differently for local development versus the deployed App Hosting environment.

### For Local Development (using `genkit:dev` or `npm run dev`)

The Genkit Google Cloud plugin (and by extension the Google Cloud SDKs) can automatically find your credentials if you are logged in via the Google Cloud CLI.

1.  **Install the gcloud CLI**: If you haven't already, [install the Google Cloud CLI](https://cloud.google.com/sdk/docs/install).

2.  **Authenticate with Application Default Credentials (ADC)**: Run the following command in your terminal and follow the prompts to log in with your Google account:

    ```bash
    gcloud auth application-default login
    ```

    This command stores your credentials in a well-known location on your local machine, where Genkit and Google Cloud client libraries can automatically find them. No further configuration is needed for your local environment.

### For Deployed App Hosting Environment

When your app is deployed to Firebase App Hosting, it runs in a secure server-side environment. The best practice is to grant the service account you created directly to the App Hosting backend's identity.

1.  **Find your App Hosting Backend's Service Account**: When you create a backend on Firebase App Hosting, it is assigned a default service account. You can find this in the [IAM & Admin page](https://console.cloud.google.com/iam-admin/iam) of the Google Cloud Console. It will look something like:
    `[backend-id]@[project-id].iam.gserviceaccount.com`.

2.  **Grant Access to Your Custom Service Account**: You need to allow the App Hosting service account to impersonate your newly created service account (`firebase-studio-analytics-reader`).

    *   Go to the [Service Accounts page](https://console.cloud.google.com/iam-admin/serviceaccounts).
    *   Find the service account you created (`firebase-studio-analytics-reader@...`).
    *   Select it, go to the **Permissions** tab.
    *   Click **Grant Access**.
    *   In the **New principals** field, paste the App Hosting backend's service account email.
    *   In the **Assign roles** dropdown, search for and select the `Service Account Token Creator` role.
    *   Click **Save**.

This setup allows your deployed backend to securely generate credentials for your custom service account without needing to manage secret keys.

## 4. Implement BigQuery Logic

Now you can use a Google Cloud client library in your code. Inside `src/ai/flows/analytics-flow.ts`, you can add the BigQuery client library to query your data.

```typescript
// Example Implementation in src/ai/flows/analytics-flow.ts

// 1. Add the BigQuery client library to your project
//    npm install @google-cloud/bigquery

import { BigQuery } from '@google-cloud/bigquery';

// ... inside the getAnalyticsForBookingFlow

    // ... after getting the booking date

    // This will automatically use the credentials configured
    // in the steps above for both local and deployed environments.
    const bigquery = new BigQuery();

    const query = `
      SELECT
        event_name,
        event_timestamp,
        (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'firebase_screen_class') as screen_name,
        -- Add other parameters you need to extract
      FROM
        \`your_analytics_project.your_dataset.events_${formattedDate}\`
      WHERE
        (SELECT value.string_value FROM UNNEST(user_properties) WHERE key = 'BOOKING_ID') = @bookingId
      ORDER BY
        event_timestamp;
    `;
    
    const options = {
      query: query,
      params: {bookingId: bookingId},
    };

    // Run the query
    const [rows] = await bigquery.query(options);

    const analyticsEvents: AnalyticsEvent[] = rows.map(row => ({
      name: row.event_name,
      timestamp: new Date(row.event_timestamp / 1000).toISOString(), // Convert microseconds to ISO string
      params: {
        screen_name: row.screen_name,
        // map other params
      }
    }));
    
    // The flow will then return these events
```

**Remember to replace `your_analytics_project.your_dataset` with your actual BigQuery project and dataset names.**
