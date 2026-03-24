import { db } from '@/storage/db';
import { syncProblemCatalog } from './syncProblemCatalog';

export async function getCatalogCategories(ensureCatalog = false): Promise<string[]> {
  if (ensureCatalog) {
    await syncProblemCatalog();
  }
  return db.getCatalogCategories();
}
