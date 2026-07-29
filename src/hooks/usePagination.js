import { useMemo, useState } from "react";

export const usePagination = (items = [], initialPageSize = 10, resetKey = "") => {
  const [paginationState, setPaginationState] = useState({
    key: resetKey,
    page: 1,
  });
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const requestedPage = paginationState.key === resetKey ? paginationState.page : 1;
  const page = Math.min(Math.max(requestedPage, 1), totalPages);

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const setPage = (value) => {
    setPaginationState((current) => {
      const currentPage = current.key === resetKey ? current.page : 1;
      const safeCurrent = Math.min(Math.max(currentPage, 1), totalPages);
      const next = typeof value === "function" ? value(safeCurrent) : value;

      return {
        key: resetKey,
        page: Math.min(Math.max(Number(next) || 1, 1), totalPages),
      };
    });
  };

  const setPageSize = (value) => {
    const nextSize = Number(value) || initialPageSize;
    setPageSizeState(nextSize);
    setPaginationState({ key: resetKey, page: 1 });
  };

  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = totalItems === 0 ? 0 : Math.min(page * pageSize, totalItems);

  return {
    page,
    setPage,
    pageSize,
    setPageSize,
    totalItems,
    totalPages,
    paginatedItems,
    startItem,
    endItem,
  };
};
