import React, { useState } from 'react';
import { X } from 'lucide-react';
import './TruncatedText.css';

export function TruncatedText({ text, title = "Details", details, className = "" }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = (e) => {
    e.stopPropagation();
    setIsOpen(true);
  };

  return (
    <>
      <span 
        className={`truncated-text ${className}`} 
        onClick={handleClick}
        title="Click to see full details"
      >
        {text}
      </span>

      {isOpen && (
        <div className="detail-modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="detail-modal-card animate-scaleUp" onClick={e => e.stopPropagation()}>
            <div className="detail-modal-header">
              <h3 className="detail-modal-title">{title}</h3>
              <button className="detail-modal-close" onClick={() => setIsOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="detail-modal-body">
              {details || <p className="detail-modal-text">{text}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
