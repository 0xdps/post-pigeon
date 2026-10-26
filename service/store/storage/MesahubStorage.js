// service/store/storage/MesahubStorage.js
// StorageProvider implementation backed by @mesahub/client (hosted sqlite-hub).
//
// Connection is configured via a single MESAHUB_URL environment variable:
//   MESAHUB_URL=mh://apikey@host/dbname
//
// parseMesahubUrl() derives apiUrl, apiKey, dbName, and the correct route prefix
// (v1 for remote hosts, api for localhost / private networks).

import { MesahubClient, parseMesahubUrl } from "@mesahub/client";

/** @type {MesahubStorage|null} */
let _instance = null;

export class MesahubStorage {
	/**
	 * @param {import('@mesahub/client').DatabaseHandle} db
	 */
	constructor(db) {
		this._db = db;
	}

	/**
	 * Return the singleton instance, creating it on first call.
	 * Reads MESAHUB_URL from environment.
	 * @returns {MesahubStorage}
	 */
	static getInstance() {
		if (!_instance) {
			const url = process.env.MESAHUB_URL;
			if (!url) {
				throw new Error(
					"Missing MESAHUB_URL environment variable.\n" +
						"Format: mh://apikey@host/dbname\n" +
						"Example: MESAHUB_URL=mh://shs_...@api.mesahub.app/my-db"
				);
			}
			const { apiUrl, apiKey, dbName, routePrefix } = parseMesahubUrl(url);
			const client = new MesahubClient({ apiKey, apiUrl, routePrefix });
			_instance = new MesahubStorage(client.db(dbName));
		}
		return _instance;
	}

	// ---------------------------------------------------------------------------
	// CRUD helpers
	// ---------------------------------------------------------------------------

	/**
	 * Insert a row and return the inserted record.
	 * @param {string} table
	 * @param {object} data
	 * @returns {Promise<object>}
	 */
	async insert(table, data) {
		return this._db.table(table).insert(data);
	}

	/**
	 * Find a single row matching the given where clause, or null.
	 * @param {string} table
	 * @param {object} where
	 * @returns {Promise<object|null>}
	 */
	async findOne(table, where) {
		if (!where || Object.keys(where).length === 0) return null;
		return this._db.table(table).findOne({ where });
	}

	/**
	 * Find multiple rows with optional filters and pagination.
	 *
	 * @param {string} table
	 * @param {object|undefined} where      - Column equality filters (all AND-ed)
	 * @param {import('./StorageProvider.js').FindOpts} opts
	 * @returns {Promise<object[]>}
	 */
	async find(table, where, opts = {}) {
		const { orderBy, order, limit, offset, columns } = opts;

		/** @type {import('@mesahub/client').FindOptions<any>} */
		const findOpts = {};

		if (where && Object.keys(where).length > 0) findOpts.where = where;
		if (columns && columns.length > 0) findOpts.select = columns;
		if (orderBy) findOpts.orderBy = [{ column: orderBy, direction: (order || "ASC").toLowerCase() }];
		if (limit != null) findOpts.limit = Number(limit);
		if (offset != null) findOpts.offset = Number(offset);

		return this._db.table(table).find(findOpts);
	}

	/**
	 * Update columns for all rows matching where.
	 * @param {string} table
	 * @param {object} data  - Columns to set
	 * @param {object} where - Row selector
	 * @returns {Promise<void>}
	 */
	async update(table, data, where) {
		await this._db.table(table).update({ where, set: data });
	}

	/**
	 * Delete rows matching where.
	 * @param {string} table
	 * @param {object} where
	 * @returns {Promise<void>}
	 */
	async delete(table, where) {
		await this._db.table(table).delete({ where });
	}

	/**
	 * Count rows matching optional where clause.
	 * @param {string} table
	 * @param {object} [where]
	 * @returns {Promise<number>}
	 */
	async count(table, where) {
		const opts = where && Object.keys(where).length > 0 ? { where } : {};
		return this._db.table(table).count(opts);
	}

	/**
	 * Execute raw SQL.
	 * SELECT / WITH / PRAGMA → routed to query(); returns { rows }.
	 * Everything else (INSERT / UPDATE / DELETE / CREATE / ALTER) → routed to exec().
	 * Returns { rows, rowsAffected } for backward compatibility with existing store code.
	 *
	 * @param {string}    sql
	 * @param {unknown[]} [params]
	 * @returns {Promise<import('./StorageProvider.js').ExecResult>}
	 */
	async exec(sql, params = []) {
		const isRead = /^\s*(SELECT|WITH|PRAGMA)\b/i.test(sql.trim());
		if (isRead) {
			const result = await this._db.query(sql, params);
			return { rows: result.rows };
		}
		const result = await this._db.exec(sql, params);
		return { rows: [], rowsAffected: result.rowsAffected };
	}

	/**
	 * Upsert (INSERT OR REPLACE) a single row by primary key.
	 * @param {string} table
	 * @param {object} data
	 * @returns {Promise<void>}
	 */
	async upsert(table, data) {
		const keys = Object.keys(data);
		const cols = keys.join(", ");
		const placeholders = keys.map(() => "?").join(", ");
		const values = keys.map((k) => data[k]);
		await this._db.exec(`INSERT OR REPLACE INTO ${table} (${cols}) VALUES (${placeholders})`, values);
	}

	/**
	 * Batch upsert (INSERT OR REPLACE) in a single statement.
	 * Splits into chunks of 50 rows to stay within SQLite parameter limits.
	 * @param {string}   table
	 * @param {object[]} records
	 * @returns {Promise<void>}
	 */
	async upsertMany(table, records) {
		if (!records || records.length === 0) return;
		const CHUNK = 50;
		const keys = Object.keys(records[0]);
		const cols = keys.join(", ");
		const rowPlaceholder = `(${keys.map(() => "?").join(", ")})`;

		for (let i = 0; i < records.length; i += CHUNK) {
			const batch = records.slice(i, i + CHUNK);
			const placeholders = batch.map(() => rowPlaceholder).join(", ");
			const values = batch.flatMap((r) => keys.map((k) => r[k]));
			await this._db.exec(`INSERT OR REPLACE INTO ${table} (${cols}) VALUES ${placeholders}`, values);
		}
	}

	// ---------------------------------------------------------------------------
	// File / blob storage
	// ---------------------------------------------------------------------------

	/**
	 * MesaHub file storage API scoped to this database.
	 * Provides: list(), upload(), download(), delete()
	 * @type {import('@mesahub/client').DatabaseHandle['files']}
	 */
	get files() {
		return this._db.files;
	}
}
