import constants from './constants';

const indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;

let db;
let debug = false;

export const init = dbg => {
  let freshlyMinted = false;
  debug = dbg;

  return new Promise((resolve, reject) => {
    const dbRequest = indexedDB.open('ctdl-game-mempool' + constants.SLOT, 1000);
    dbRequest.onerror = event => {
      if (debug) console.log('Database error code: ', event);
      reject(event);
    };
    dbRequest.onsuccess = event => {
      db = event.target.result;
      if (debug) console.log('Database connected', db);
      resolve(freshlyMinted);
    };
    dbRequest.onupgradeneeded = event => {
      db = event.target.result;
      const objectStoreState = db.createObjectStore(
        'state', {
          'keyPath': 'id'
        }
      );
      objectStoreState.createIndex('id', 'id', {
        'unique': true
      });
      freshlyMinted = true;
    };
  });
};

export const destroy = () => {
  return new Promise(resolve => {
    const dbRequest = indexedDB.deleteDatabase('ctdl-game' + constants.SLOT);
    dbRequest.onsuccess = () => {
      if (debug) console.log('Database destroyed');
      resolve();
    };
  });
};

export const set = (key, value) => {
  return new Promise(resolve => {
    const state = db.transaction(['state'], 'readwrite').objectStore('state');
    const updateRequest = state.get(key);

    updateRequest.onerror = () => {
      if (debug) console.log('Create entry', key, value);
      state.add({
        'id': key,
        'value': value
      });
      resolve();
    };
    updateRequest.onsuccess = () => {
      if (debug) console.log('Updated entry', key, value);
      state.put({
        'id': key,
        'value': value
      });
      resolve();
    };
  });
};

export const remove = (key) => {
  return new Promise(resolve => {
    const state = db.transaction(['state'], 'readwrite').objectStore('state');
    const deleteRequest = state.delete(key);

    deleteRequest.onerror = () => {
      if (debug) console.log('Remove entry', key);
      state.add({
        'id': key,
        'value': value
      });
      resolve();
    };
    deleteRequest.onsuccess = () => {
      if (debug) console.log('Removed entry', key);
      resolve();
    };
  });
};

export const get = key => {
  return new Promise(resolve => {
    const state = db.transaction(['state'], 'readonly').objectStore('state');
    const request = state.get(key);
    request.onerror = () => {
      resolve(null);
    };
    request.onsuccess = event => {
      // Get the old value that we want to update
      resolve(event.target.result ? event.target.result.value : null);
    };
  });
};