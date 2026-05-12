// service/store/storage/StorageProvider.js
// Interface contract for all storage implementations.
//
// To add a new backend (e.g. PostgreSQL, MongoDB):
//   1. Create a new file (e.g. PostgresStorage.js) that implements every
//      method documented below.
//   2. Change the import in service/store/storage/index.js to your class.
//   3. All store modules continue to work unchanged.

/**
 * @typedef {Object} FindOpts
 * @property {string}   [orderBy]  - Column name to ORDER BY
 * @property {string}   [order]    - 'ASC' | 'DESC' (default: 'ASC')
 * @property {number}   [limit]    - Max rows to return
 * @property {number}   [offset]   - Row offset for pagination
 * @property {string[]} [columns]  - SELECT only these columns (default: all)
 */

/**
 * @typedef {Object} ExecResult
 * @property {object[]} rows           - Populated for SELECT / WITH / PRAGMA
 * @property {number}   [rowsAffected] - Populated for INSERT / UPDATE / DELETE
 */

/**
 * @typedef {Object} FileStorageApi
 * @property {function(object): Promise<{files: object[]}>} list
 *   List stored files. Opts: { limit, offset, folderPrefix }
 * @property {function(Blob|ArrayBuffer, string, string=): Promise<object>} upload
 *   Upload a file. Returns a FileRecord with at least { id, filename, url }.
 * @property {function(string): Promise<object>} download
 *   Download a file by ID. Returns a StreamResponse with { status, stream, headers }.
 * @property {function(string): Promise<void>} delete
 *   Delete a file by ID.
 */

/**
 * @interface StorageProvider
 *
 * All method signatures correspond to SQL semantics so that any relational
 * storage engine can implement them with minimal adaptation.
 *
 * @method insert(table: string, data: object): Promise<object>
 *   Insert a row; return the inserted record.
 *
 * @method findOne(table: string, where: object): Promise<object|null>
 *   Return the first row matching where, or null.
 *
 * @method find(table: string, where?: object, opts?: FindOpts): Promise<object[]>
 *   Return all rows matching optional filter / ordering / pagination.
 *
 * @method update(table: string, data: object, where: object): Promise<void>
 *   Update columns for all rows matching where.
 *
 * @method delete(table: string, where: object): Promise<void>
 *   Delete rows matching where.
 *
 * @method count(table: string, where?: object): Promise<number>
 *   Count rows matching optional where.
 *
 * @method exec(sql: string, params?: unknown[]): Promise<ExecResult>
 *   Execute raw SQL. SELECT / WITH / PRAGMA → rows array.
 *   INSERT / UPDATE / DELETE / CREATE / ALTER → rowsAffected.
 *
 * @method upsert(table: string, data: object): Promise<void>
 *   INSERT OR REPLACE a single row (upsert by primary key).
 *
 * @method upsertMany(table: string, records: object[]): Promise<void>
 *   Batch INSERT OR REPLACE.
 *
 * @property {FileStorageApi} files
 *   Blob / file storage access.
 */
