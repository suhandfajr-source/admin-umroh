import { DbRepository } from '../src/lib/repository/db';

async function main() {
  console.log('>>> Membersihkan seluruh data dummy...');
  DbRepository.resetStore();
  console.log('>>> Database berhasil dikosongkan. Siap digunakan untuk operasional riil!');
}

main().catch(console.error);
