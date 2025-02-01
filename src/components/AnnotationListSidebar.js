// AnnotationListSidebar.js

import React from 'react';
import './AnnotationListSidebar.css';

export default function AnnotationListSidebar({
  annotations,
  onDeleteAnnotation,
  onUpdateAnnotation,
  labelClasses,
}) {
  // Handle label dropdown changes for a specific annotation
  const handleLabelDropdown = (idx, newLabel) => {
    const labelColor =
      labelClasses.find((lc) => lc.name === newLabel)?.color || '#ff0000';

    onUpdateAnnotation(idx, { label: newLabel, color: labelColor });
  };

  return (
    <div className="anno-sidebar">
      <h3>Annotations</h3>
      {annotations.length === 0 && <p>No annotations yet.</p>}
      {annotations.map((ann, i) => {
        const label = ann.label || '';
        return (
          <div key={i} className="anno-item">
            <div>
              <span className="shape-type">{ann.type.toUpperCase()}</span>{' '}
              <span className="shape-label">{label}</span>
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
              <button onClick={() => onDeleteAnnotation(i)}>Del</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
