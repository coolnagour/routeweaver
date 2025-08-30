
import { sqliteTable, text, integer, primaryKey, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import type { JourneyStatus, Stop, Location, BookingExtra, SplitPaymentSettings, AccountField } from '@/types';
import { v4 as uuidv4 } from 'uuid';


export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    email: text('email', {
        mode: "text"
    }).notNull().unique(),
    displayName: text('display_name'),
    photoURL: text('photo_url'),
});

export const servers = sqliteTable('servers', {
    uuid: text('uuid').primaryKey().$defaultFn(() => uuidv4()),
    name: text('name').notNull(),
    host: text('host').notNull(),
    apiPath: text('api_path').notNull(),
    appKey: text('app_key').notNull(),
    secretKey: text('secret_key').notNull(),
    companyId: text('company_id').notNull(),
    countryCodes: text('country_codes').notNull().$type<string[]>(),
    usageCount: integer('usage_count').default(0),
});


export const journeys = sqliteTable('journeys', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    serverScope: text('server_scope').notNull(),
    name: text('name'),
    journeyServerId: integer('journey_server_id'),
    status: text('status').$type<JourneyStatus>().default('Draft'),
    siteId: integer('site_id'),
    siteName: text('site_name'),
    siteRef: text('site_ref'),
    accountId: integer('account_id'),
    accountName: text('account_name'),
    accountRef: text('account_ref'),
    price: real('price'),
    cost: real('cost'),
    enable_messaging_service: integer('enable_messaging_service', { mode: 'boolean' }).default(false),
    driverId: text('driver_id'),
    driverRef: text('driver_ref'),
});

export const bookings = sqliteTable('bookings', {
    id: text('id').primaryKey(),
    journeyId: text('journey_id').notNull().references(() => journeys.id, { onDelete: 'cascade' }),
    bookingServerId: integer('booking_server_id'),
    stops: text('stops', { mode: 'json' }).$type<Stop[]>().notNull(),
    customerId: text('customer_id'),
    externalBookingId: text('external_booking_id'),
    vehicleType: text('vehicle_type'),
    externalAreaCode: text('external_area_code'),
    price: real('price'),
    cost: real('cost'),
    instructions: text('instructions'),
    holdOn: integer('hold_on', { mode: 'boolean' }).default(false),
    splitPaymentSettings: text('split_payment_settings', { mode: 'json' }).$type<SplitPaymentSettings>(),
    metadata: text('metadata', { mode: 'json' }).$type<Array<{ key: string; value: string }>>(),
    fields: text('fields', { mode: 'json' }).$type<Array<{ id: string; value: string }>>(),
    extrasConfig: text('extras_config', { mode: 'json' }).$type<BookingExtra[]>(),
    modified: integer('modified', { mode: 'boolean' }).default(false),
});

export const templates = sqliteTable('templates', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    serverScope: text('server_scope').notNull(),
    name: text('name').notNull(),
    siteId: integer('site_id'),
    siteName: text('site_name'),
    siteRef: text('site_ref'),
    accountId: integer('account_id'),
    accountName: text('account_name'),
    accountRef: text('account_ref'),
    price: real('price'),
    cost: real('cost'),
    enable_messaging_service: integer('enable_messaging_service', { mode: 'boolean' }).default(false),
});

export const template_bookings = sqliteTable('template_bookings', {
    id: text('id').primaryKey(),
    templateId: text('template_id').notNull().references(() => templates.id, { onDelete: 'cascade' }),
    stops: text('stops', { mode: 'json' }).$type<Stop[]>().notNull(),
    customerId: text('customer_id'),
    externalBookingId: text('external_booking_id'),
    vehicleType: text('vehicle_type'),
    externalAreaCode: text('external_area_code'),
    price: real('price'),
    cost: real('cost'),
    instructions: text('instructions'),
    holdOn: integer('hold_on', { mode: 'boolean' }).default(false),
    splitPaymentSettings: text('split_payment_settings', { mode: 'json' }).$type<SplitPaymentSettings>(),
    metadata: text('metadata', { mode: 'json' }).$type<Array<{ key: string; value: string }>>(),
    fields: text('fields', { mode: 'json' }).$type<Array<{ id: string; value: string }>>(),
    extrasConfig: text('extras_config', { mode: 'json' }).$type<BookingExtra[]>(),
    modified: integer('modified', { mode: 'boolean' }).default(false),
});


// RELATIONS
export const usersRelations = relations(users, ({ many }) => ({
  journeys: many(journeys),
  templates: many(templates),
}));

export const journeysRelations = relations(journeys, ({ one, many }) => ({
  user: one(users, {
    fields: [journeys.userId],
    references: [users.id],
  }),
  bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
    journey: one(journeys, {
        fields: [bookings.journeyId],
        references: [journeys.id],
    }),
}));

export const templatesRelations = relations(templates, ({ one, many }) => ({
  user: one(users, {
    fields: [templates.userId],
    references: [users.id],
  }),
  bookings: many(template_bookings),
}));

export const templateBookingsRelations = relations(template_bookings, ({ one }) => ({
    template: one(templates, {
        fields: [template_bookings.templateId],
        references: [templates.id],
    }),
}));
