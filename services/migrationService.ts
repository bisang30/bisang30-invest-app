
import { DATA_VERSION } from '../constants';

// useLocalStorage 훅에서 사용하는 모든 키 목록
const LOCAL_STORAGE_KEYS = [
  'theme',
  'app-password',
  'brokers',
  'accounts',
  'stocks',
  'trades',
  'transactions',
  'initialPortfolio',
  'monthlyValues',
  'bankAccounts',
];

// 향후 마이그레이션 함수가 여기에 추가됩니다.
// 각 함수는 버전 N에서 N+1로의 마이그레이션을 처리합니다.
// 예시:
/*
const migrateV1ToV2 = () => {
  console.log("Migrating data from v1 to v2...");
  const tradesStr = localStorage.getItem('trades');
  if (tradesStr) {
    const trades = JSON.parse(tradesStr);
    const migratedTrades = trades.map(trade => ({
      ...trade,
      newField: 'defaultValue', // 새 필드 추가
    }));
    localStorage.setItem('trades', JSON.stringify(migratedTrades));
  }
  console.log("Migration v1 to v2 complete.");
};
*/

// MIGRATIONS 객체는 마이그레이션을 시작할 버전을 키로 사용합니다.
// 예: 키 0은 버전 0에서 1로의 마이그레이션을 의미합니다.
const MIGRATIONS: { [version: number]: () => void } = {
  // 0: migrateV0ToV1,
  // 1: migrateV1ToV2,
};

/**
 * 저장된 데이터 버전과 앱의 데이터 버전을 비교하여 데이터 마이그레이션을 실행합니다.
 * @returns {boolean} 마이그레이션이 실행되어 페이지 새로고침이 필요한 경우 true를 반환합니다.
 */
export const runMigrations = (): boolean => {
  const storedVersionStr = localStorage.getItem('data-version');
  let currentVersion = storedVersionStr ? parseInt(storedVersionStr, 10) : 0;
  let migrationsWereRun = false;

  if (currentVersion >= DATA_VERSION) {
    return false; // 데이터가 최신 버전입니다.
  }

  // 버전 관리 시스템이 도입되기 전이거나 데이터가 초기화된 경우
  if (currentVersion === 0) {
    const dataExists = LOCAL_STORAGE_KEYS.some(key => localStorage.getItem(key) !== null);
    if (!dataExists) {
        // 새로 설치한 경우, 버전만 설정합니다.
        localStorage.setItem('data-version', String(DATA_VERSION));
        console.log(`Initialized data version to ${DATA_VERSION}.`);
        return false;
    }
  }

  console.log(`Current data version: ${currentVersion}. Migrating to ${DATA_VERSION}...`);

  // 마이그레이션을 순차적으로 실행합니다.
  for (let v = currentVersion; v < DATA_VERSION; v++) {
    const migrationFunc = MIGRATIONS[v];
    if (migrationFunc) {
      try {
        console.log(`Applying migration for version ${v + 1}...`);
        migrationFunc();
        migrationsWereRun = true;
      } catch (error) {
        console.error(`Migration for version ${v + 1} failed:`, error);
        // 실패 시 데이터 손상을 방지하기 위해 마이그레이션을 중단합니다.
        return false;
      }
    }
  }

  // 모든 마이그레이션이 성공적으로 완료되면 localStorage의 버전을 업데이트합니다.
  localStorage.setItem('data-version', String(DATA_VERSION));
  console.log(`Data migration complete. Current version: ${DATA_VERSION}`);
  
  return migrationsWereRun;
};