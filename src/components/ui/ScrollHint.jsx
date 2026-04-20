import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import './ScrollHint.css'

/**
 * ScrollHint Component
 * Provides horizontal scroll controls for a target element.
 * @param {Object} targetRef - React ref of the scrollable container
 */
export function ScrollHint({ targetRef }) {
  const [showLeft, setShowLeft] = useState(false)
  const [showRight, setShowRight] = useState(false)
  const [canScroll, setCanScroll] = useState(false)

  const checkScroll = useCallback(() => {
    if (targetRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = targetRef.current
      setCanScroll(scrollWidth > clientWidth + 2) // Content is wider than container
      setShowLeft(scrollLeft > 5)
      setShowRight(scrollLeft < scrollWidth - clientWidth - 5)
    }
  }, [targetRef])

  useEffect(() => {
    const el = targetRef.current
    if (!el) return

    checkScroll()
    el.addEventListener('scroll', checkScroll)
    window.addEventListener('resize', checkScroll)

    // Mutation observer to handle content changes
    const observer = new MutationObserver(checkScroll)
    observer.observe(el, { childList: true, subtree: true })

    return () => {
      el.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
      observer.disconnect()
    }
  }, [checkScroll, targetRef])

  const scroll = (direction) => {
    if (targetRef.current) {
      const amount = 200
      targetRef.current.scrollBy({
        left: direction === 'left' ? -amount : amount,
        behavior: 'smooth'
      })
    }
  }

  if (!canScroll) return null

  return (
    <div className="scroll-hint">
      <span className="scroll-hint__label">Scroll</span>
      <div className="scroll-hint__controls">
        <button 
          className={`scroll-hint__btn ${showLeft ? 'scroll-hint__btn--visible' : ''}`}
          onClick={() => scroll('left')}
          aria-label="Scroll left"
          disabled={!showLeft}
        >
          <ChevronLeft size={16} />
        </button>
        <button 
          className={`scroll-hint__btn ${showRight ? 'scroll-hint__btn--visible' : ''}`}
          onClick={() => scroll('right')}
          aria-label="Scroll right"
          disabled={!showRight}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

export default ScrollHint;