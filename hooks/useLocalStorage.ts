import { useState, useEffect, Dispatch, SetStateAction } from 'react';

// FIX: Imported Dispatch and SetStateAction to resolve 'Cannot find namespace React' error.
export const useLocalStorage = <T,>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item === null) {
        return initialValue;
      }
      
      let parsedItem;
      try {
        parsedItem = JSON.parse(item);
      } catch (e) {
        console.error(`'${key}' 키의 localStorage 파싱 오류 (JSON):`, e);
        return initialValue;
      }

      // 저장된 값이 null이고 초기값이 null이 아닌 경우, 충돌을 방지하기 위해 초기값을 반환합니다.
      if (parsedItem === null && initialValue !== null) {
        return initialValue;
      }

      // --- 데이터 타입 무결성 검사 ---
      const initialIsArray = Array.isArray(initialValue);
      const parsedIsArray = Array.isArray(parsedItem);

      // 배열이 예상되었지만 실제로는 배열이 아닌 경우 (예: 객체 {}), 데이터 손상으로 간주하고 초기값으로 대체합니다.
      if (initialIsArray && !parsedIsArray) {
        console.warn(`'${key}' 키 데이터 손상: 배열이 필요하지만 다른 타입이 감지되었습니다. 초기값으로 복구합니다.`);
        return initialValue;
      }

      // 배열인 경우, 내부의 null 또는 비객체 항목을 제거하여 안정성을 높입니다.
      if (parsedIsArray) {
        const sanitizedArray = parsedItem.filter(i => i !== null && typeof i === 'object');
        if (sanitizedArray.length < parsedItem.length) {
          console.warn(`'${key}' 키 데이터 손상: 배열에서 유효하지 않은 항목(null 등)을 제거했습니다.`);
        }
        return sanitizedArray as T;
      }

      // 모든 검사를 통과한 경우, 파싱된 아이템을 반환합니다.
      return parsedItem;

    } catch (error) {
      console.error(`'${key}' 키의 localStorage 처리 중 예기치 않은 오류 발생:`, error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  // FIX: Used imported Dispatch and SetStateAction types.
  return [storedValue, setValue as Dispatch<SetStateAction<T>>];
};