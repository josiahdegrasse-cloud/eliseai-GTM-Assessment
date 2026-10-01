import {sqliteTable, text, integer, index, uniqueIndex} from 'drizzle-orm/sqlite-core';
export const sessions = sqliteTable('visitor_sessions', {
  id: text('id').primaryKey(), csrf: text('csrf').notNull(), expires: integer('expires').notNull(),
}, t => [index('idx_sessions_expiry').on(t.expires)]);
export const leads = sqliteTable('visitor_leads', {
  id: text('id').primaryKey(), sessionId: text('session_id').notNull().references(() => sessions.id, {onDelete:'cascade'}),
  identity: text('identity').notNull(), data: text('data').notNull(), version: integer('version').notNull().default(0),
  processingUntil: integer('processing_until').notNull().default(0),
}, t => [uniqueIndex('idx_lead_owner_identity').on(t.sessionId,t.identity)]);
export const cache = sqliteTable('visitor_cache', {
  key: text('key').primaryKey(), sessionId: text('session_id').notNull().references(() => sessions.id, {onDelete:'cascade'}),
  data: text('data').notNull(), expires: integer('expires').notNull(),
}, t => [index('idx_cache_owner').on(t.sessionId)]);
export const publicCache = sqliteTable('public_sample_cache', {
  key: text('key').primaryKey(), data: text('data').notNull(), expires: integer('expires').notNull(),
});
export const limits = sqliteTable('request_limits', {
  bucket: text('bucket').primaryKey(), n: integer('n').notNull(), expires: integer('expires').notNull(),
}, t => [index('idx_limits_expiry').on(t.expires)]);
export const audit = sqliteTable('security_events', {
  id: text('id').primaryKey(), actor: text('actor').notNull(), action: text('action').notNull(), at: integer('at').notNull(),
}, t => [index('idx_events_at').on(t.at)]);
export const sheetConnections = sqliteTable('sheet_connections', {
  id:text('id').primaryKey(), sessionId:text('session_id').notNull().references(()=>sessions.id,{onDelete:'cascade'}),
  tokenHash:text('token_hash').notNull(), spreadsheetId:text('spreadsheet_id').notNull(), tabName:text('tab_name').notNull(),
  createdAt:integer('created_at').notNull(), expires:integer('expires').notNull(), lastSyncAt:integer('last_sync_at'),
  received:integer('received').notNull().default(0), lastError:text('last_error'),
},t=>[uniqueIndex('idx_sheet_owner').on(t.sessionId),uniqueIndex('idx_sheet_token').on(t.tokenHash)]);
export const emailConnections=sqliteTable('email_connections',{
 id:text('id').primaryKey(),sessionId:text('session_id').notNull().references(()=>sessions.id,{onDelete:'cascade'}),tokenHash:text('token_hash').notNull(),provider:text('provider').notNull(),labelName:text('label_name').notNull(),expires:integer('expires').notNull(),lastSyncAt:integer('last_sync_at'),
},t=>[uniqueIndex('idx_email_connection_owner').on(t.sessionId),uniqueIndex('idx_email_connection_token').on(t.tokenHash)]);
export const emailMessages=sqliteTable('email_messages',{
 id:text('id').primaryKey(),sessionId:text('session_id').notNull().references(()=>sessions.id,{onDelete:'cascade'}),fingerprint:text('fingerprint').notNull(),data:text('data').notNull(),status:text('status').notNull().default('pending'),createdAt:integer('created_at').notNull(),
},t=>[uniqueIndex('idx_email_message_unique').on(t.sessionId,t.fingerprint),index('idx_email_message_review').on(t.sessionId,t.status,t.createdAt)]);
export const researchRuns=sqliteTable('research_runs',{
 id:text('id').primaryKey(),sessionId:text('session_id').notNull().references(()=>sessions.id,{onDelete:'cascade'}),leadId:text('lead_id').references(()=>leads.id,{onDelete:'cascade'}),
 source:text('source').notNull(),status:text('status').notNull(),startedAt:integer('started_at').notNull(),finishedAt:integer('finished_at'),message:text('message').notNull(),code:text('code'),
},t=>[index('idx_runs_owner_time').on(t.sessionId,t.startedAt),index('idx_runs_lead_time').on(t.sessionId,t.leadId,t.startedAt)]);
export const assessmentSnapshots=sqliteTable('assessment_snapshots',{
 id:text('id').primaryKey(),sessionId:text('session_id').notNull().references(()=>sessions.id,{onDelete:'cascade'}),leadId:text('lead_id').notNull().references(()=>leads.id,{onDelete:'cascade'}),
 at:integer('at').notNull(),reason:text('reason').notNull(),data:text('data').notNull(),
},t=>[index('idx_snapshots_owner_lead').on(t.sessionId,t.leadId,t.at)]);
