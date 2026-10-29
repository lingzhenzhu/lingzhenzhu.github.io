import { useState } from 'react';
export function usePagination(count: number, key = '', pageSize = 30) {
  const [position, setPosition] = useState({ key, page: 0 });
  const page =
    position.key === key ? Math.min(position.page, Math.max(0, Math.ceil(count / pageSize) - 1)) : 0;
  return {
    page,
    pageSize,
    count,
    start: page * pageSize,
    end: (page + 1) * pageSize,
    onChange: (next: number) => setPosition({ key, page: Math.max(0, next) }),
  };
}
