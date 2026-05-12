// service/store/storage/index.js
// Storage layer entry point.
//
// To swap backends, change the import below and return an instance of your
// new StorageProvider implementation instead. All store modules call getStorage()
// and depend only on the StorageProvider interface — no other changes required.
//
// Current backend : MesaHub (@mesahub/client)
// Future examples : PostgresStorage, MongoStorage, SqliteStorage

import { MesahubStorage } from "./MesahubStorage.js";

/**
 * Return the active storage provider singleton.
 * @returns {import('./MesahubStorage.js').MesahubStorage}
 */
export function getStorage() {
	return MesahubStorage.getInstance();
}
