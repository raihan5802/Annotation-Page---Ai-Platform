// AnnotationListSidebar.js

import React from 'react';
import './AnnotationListSidebar.css';

// SVG Icons
const OpacityIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22C6.5 22 2 17.5 2 12S6.5 2 12 2s10 4.5 10 10-4.5 10-10 10z" />
    <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z" />
    <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
  </svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

export default function AnnotationListSidebar({
  annotations,
  onDeleteAnnotation,
  onUpdateAnnotation,
  labelClasses,
  onOpenOpacityControl,
  showOpacityControl,
  selectedAnnotationIndex,
  currentShapes,
  onCloseOpacityControl,
}) {
  // Handle label dropdown changes for a specific annotation
  const handleLabelDropdown = (idx, newLabel) => {
    const labelColor =
      labelClasses.find((lc) => lc.name === newLabel)?.color || '#ff0000';

    onUpdateAnnotation(idx, { label: newLabel, color: labelColor });
  };

  // Handle click on annotation to select it
  const handleAnnotationClick = (idx) => {
    if (selectedAnnotationIndex === idx) {
      onCloseOpacityControl();
    } else {
      onOpenOpacityControl(idx);
    }
  };

  return (
    <div className="anno-sidebar">
      <h3>Annotations</h3>
      {annotations.length === 0 && <p>No annotations yet.</p>}
      {annotations.map((ann, i) => {
        const label = ann.label || '';
        const opacity = ann.opacity !== undefined ? ann.opacity : 1.0;
        const opacityPercent = Math.round(opacity * 100);
        
        return (
          <div 
            key={i} 
            className={`anno-item ${selectedAnnotationIndex === i ? 'active' : ''}`}
            onClick={() => handleAnnotationClick(i)}
          >
            <div>
              <span className="shape-type">{ann.type.toUpperCase()}</span>{' '}
              <span className="shape-label">{label}</span>
              {opacityPercent !== 100 && (
                <span className="opacity-label">({opacityPercent}%)</span>
              )}
              {ann.instanceId && (
                <span style={{ marginLeft: 8 }}>({ann.instanceId})</span>
              )}
            </div>
            <div className="anno-actions">
              <select
                value={label}
                onChange={(e) => handleLabelDropdown(i, e.target.value)}
              >
                {labelClasses.map((lc, idx2) => (
                  <option key={idx2} value={lc.name}>
                    {lc.name}
                  </option>
                ))}
              </select>
              <button 
                onClick={() => onDeleteAnnotation(i)}
                className="delete-button"
              >
                Del
              </button>
            </div>
          </div>
        );
      })}
      
      {/* Floating Opacity Control */}
      {showOpacityControl && selectedAnnotationIndex !== null && (
        <FloatingOpacityControl
          selectedAnnotationIndex={selectedAnnotationIndex} 
          currentShapes={currentShapes}
          onUpdateAnnotation={onUpdateAnnotation}
          onClose={onCloseOpacityControl}
        />
      )}
    </div>
  );
}

const FloatingOpacityControl = ({ selectedAnnotationIndex, currentShapes, onUpdateAnnotation, onClose }) => {
  const [opacityValue, setOpacityValue] = React.useState(100);

  React.useEffect(() => {
    if (selectedAnnotationIndex !== null) {
      const currentOpacity = currentShapes[selectedAnnotationIndex].opacity !== undefined
        ? Math.round(currentShapes[selectedAnnotationIndex].opacity * 100)
        : 100;
      setOpacityValue(currentOpacity);
    }
  }, [selectedAnnotationIndex, currentShapes]);

  const handleOpacityChange = (value) => {
    setOpacityValue(value);
    const decimal = value / 100;
    onUpdateAnnotation(selectedAnnotationIndex, { opacity: decimal });
  };

  if (selectedAnnotationIndex === null) return null;
  
  return (
    <div className="floating-opacity-control">
      <div className="opacity-control-header">
        <h4>Adjust Opacity</h4>
        <button onClick={onClose} className="close-button">
          <CloseIcon />
        </button>
      </div>
      
      <div className="opacity-slider-container">
        <input
          type="range"
          min="0"
          max="100"
          value={opacityValue}
          onChange={(e) => handleOpacityChange(parseInt(e.target.value))}
          className="opacity-slider"
        />
        <div className="opacity-value">{opacityValue}%</div>
      </div>
      
      <div 
        className="preview-box"
        style={{ 
          backgroundColor: currentShapes[selectedAnnotationIndex]?.color || '#000000',
          opacity: opacityValue / 100
        }}
      />
    </div>
  );
};