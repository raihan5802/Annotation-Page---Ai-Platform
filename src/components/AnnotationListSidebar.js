import React, { useState } from 'react';
import './AnnotationListSidebar.css';

export default function AnnotationListSidebar({
  annotations,
  onDeleteAnnotation,
  onUpdateAnnotation,
  labelClasses
}) {
  const [editingIndex, setEditingIndex] = useState(null);
  const [tempLabel, setTempLabel] = useState('');

  const startEdit = (idx, label) => {
    setEditingIndex(idx);
    setTempLabel(label);
  };

  const saveEdit = (idx) => {
    onUpdateAnnotation(idx, { label: tempLabel });
    setEditingIndex(null);
    setTempLabel('');
  };

  const handleLabelDropdown = (idx, newLabel) => {
    onUpdateAnnotation(idx, { label: newLabel });
  };

  return (
    <div className="anno-sidebar">
      <h3>Annotations</h3>
      {annotations.length === 0 && <p>No annotations yet.</p>}
      {annotations.map((ann, i) => {
        const label = ann.label || 'unknown';
        const isEditing = editingIndex === i;

        return (
          <div key={i} className="anno-item">
            <div>
              <span className="shape-type">{ann.type.toUpperCase()}</span>
              {' '}
              {!isEditing ? (
                <span className="shape-label">{label}</span>
              ) : (
                <input
                  type="text"
                  value={tempLabel}
                  onChange={(e) => setTempLabel(e.target.value)}
                  style={{ marginLeft: 6 }}
                />
              )}
            </div>
            <div className="anno-actions">
              {!isEditing ? (
                <>
                  <select
                    value={label}
                    onChange={(e) => handleLabelDropdown(i, e.target.value)}
                  >
                    {labelClasses.map((lc, idx) => (
                      <option key={idx} value={lc.name}>
                        {lc.name}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => startEdit(i, label)}>Edit</button>
                  <button onClick={() => onDeleteAnnotation(i)}>Del</button>
                </>
              ) : (
                <button onClick={() => saveEdit(i)}>Save</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
