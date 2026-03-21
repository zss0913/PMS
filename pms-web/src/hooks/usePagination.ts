import { useState, useMemo, useEffect } from 'react'
import type { PageSize } from '@/components/Pagination'

export function usePagination<T>(items: T[], defaultPageSize: PageSize = 15) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(defaultPageSize)

  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, page, pageSize])

  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const handlePageChange = (newPage: number) => {
    setPage(Math.max(1, Math.min(newPage, totalPages)))
  }

  const handlePageSizeChange = (newSize: PageSize) => {
    setPageSize(newSize)
    setPage(1)
  }

  return {
    page,
    pageSize,
    total,
    paginatedItems,
    handlePageChange,
    handlePageSizeChange,
    setPage,
  }
}
