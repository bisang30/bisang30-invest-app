import React, { useState, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { runMigrations } from './services/migrationService';
import ErrorBoundary from './components/ErrorBoundary';

// 서비스 워커 등록 (인라인 방식)
// 'new Notification()' 생성자 직접 호출로 인한 오류를 해결하기 위함입니다.
if ('serviceWorker' in navigator) {
  const swCode = `
    self.addEventListener('install', (event) => {
      self.skipWaiting();
    });

    self.addEventListener('activate', (event) => {
      event.waitUntil(self.clients.claim());
    });

    self.addEventListener('notificationclick', (event) => {
      event.notification.close();
      event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
          if (clientList.length > 0) {
            let client = clientList[0];
            for (let i = 0; i < clientList.length; i++) {
              if (clientList[i].focused) {
                client = clientList[i];
              }
            }
            return client.focus();
          }
          return clients.openWindow('/');
        })
      );
    });
  `;
  const blob = new Blob([swCode], { type: 'application/javascript' });
  const swUrl = URL.createObjectURL(blob);

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swUrl)
      .then(registration => {
        console.log('Inline ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch(error => {
        console.log('Inline ServiceWorker registration failed: ', error);
      });
  });
}


// 앱이 렌더링되기 전에 데이터 마이그레이션을 실행합니다.
// useLocalStorage 훅은 초기 로드 시 마이그레이션된 데이터를 읽게 됩니다.
// 페이지 새로고침은 AI Studio 환경에서 문제를 일으킬 수 있으므로 제거되었습니다.
runMigrations();

const AppWrapper: React.FC = () => {
  const [appKey, setAppKey] = useState(0);

  // 이 함수는 데이터 복원이나 가져오기가 완료된 후 호출되어,
  // App 컴포넌트의 key를 변경함으로써 전체 리렌더링(리마운트)을 강제합니다.
  // 이 방법은 AI Studio와 같은 샌드박스 환경에서 window.location.reload()보다 훨씬 안전합니다.
  const forceRemount = useCallback(() => {
    setAppKey(prevKey => prevKey + 1);
  }, []);

  return <App key={appKey} onForceRemount={forceRemount} />;
};


const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppWrapper />
    </ErrorBoundary>
  </React.StrictMode>
);