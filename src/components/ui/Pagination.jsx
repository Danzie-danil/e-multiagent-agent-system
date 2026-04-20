// components/ui/Pagination.jsx
import { ChevronLeft, ChevronRight } from 'lucide-react'
import './Pagination.css'

export function Pagination({ currentPage, totalCount, pageSize, onPageChange, loading }) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const isFirstPage = currentPage === 1
  const isLastPage = currentPage === totalPages || totalCount === 0

  if (totalCount === 0 && !loading) return null

  return (
    <div className={`pagination-container ${loading ? 'pagination--loading' : ''}`}>
      <button 
        className="pagination__btn pagination__btn--prev" 
        onClick={() => onPageChange(currentPage - 1)}
        disabled={isFirstPage || loading}
        aria-label="Previous Page"
      >
        <ChevronLeft size={16} />
      </button>

      <div className="pagination__main">
        <div className="pagination__info">
          Showing <strong>{Math.min((currentPage - 1) * pageSize + 1, totalCount)}</strong> to{' '}
          <strong>{Math.min(currentPage * pageSize, totalCount)}</strong> of <strong>{totalCount}</strong> results
        </div>
        <div className="pagination__page-indicator">
          Page {currentPage} of {totalPages}
        </div>
      </div>
      
      <button 
        className="pagination__btn pagination__btn--next" 
        onClick={() => onPageChange(currentPage + 1)}
        disabled={isLastPage || loading}
        aria-label="Next Page"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
