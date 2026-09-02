import { DbRepository } from '../src/lib/repository/db';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('>>> Membersihkan seluruh data dummy (Paket Syawal, Ahmad, Fatimah, dll)...');
  
  DbRepository.resetStore();

  const dbPath = path.resolve('.data/db_store.json');
  console.log('>>> Menyimpan database bersih ke:', dbPath);

  console.log('>>> Seluruh data dummy berhasil dihapus 100%!');
}

main().catch(console.error);
