
import { Sale, Purchase, Medicine, AppSettings } from '../types';

const DB_NAME = 'PharmaSmart_DB_v5';
const DB_VERSION = 5;

export class PharmaDatabase {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('sales')) {
          db.createObjectStore('sales', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('purchases')) {
          db.createObjectStore('purchases', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('inventory')) {
          db.createObjectStore('inventory', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async getStore(name: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
    if (!this.db) await this.init();
    const transaction = this.db!.transaction(name, mode);
    return transaction.objectStore(name);
  }

  async saveSale(sale: Sale): Promise<void> {
    const store = await this.getStore('sales', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(sale);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllSales(): Promise<Sale[]> {
    const store = await this.getStore('sales', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async savePurchase(purchase: Purchase): Promise<void> {
    const store = await this.getStore('purchases', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(purchase);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllPurchases(): Promise<Purchase[]> {
    const store = await this.getStore('purchases', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Saves the entire inventory to disk.
   * Fixed: Now waits for the transaction 'oncomplete' event to ensure 
   * all additions are physically committed to the hard drive.
   */
  async saveInventory(medicines: Medicine[]): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('inventory', 'readwrite');
      const store = transaction.objectStore('inventory');
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      
      // Clear existing records and add new ones in one atomic transaction
      store.clear();
      medicines.forEach(med => {
        store.add(med);
      });
    });
  }

  async getInventory(): Promise<Medicine[]> {
    const store = await this.getStore('inventory', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteRecord(storeName: string, id: string): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const db = new PharmaDatabase();
