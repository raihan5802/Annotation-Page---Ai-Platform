import React from 'react';
import './AnnotationTopBar.css';

export default function AnnotationTopBar({
  onHome,
  onPrev,
  onNext,
  onSave,
  onZoomIn,
  onZoomOut,
  onExport,
  currentIndex,
  total,
  taskName
}) {
  return (
    <div className="anno-topbar">
      <div className="left-buttons">
        <button onClick={onHome}>Home</button>
        <button onClick={onPrev} disabled={currentIndex <= 0}>Prev</button>
        <button onClick={onNext} disabled={currentIndex >= total - 1}>Next</button>
        <button onClick={onSave}>Save (S)</button>
        <button onClick={onExport}>Export</button>
      </div>
      <div className="middle-info">
        {taskName && <span className="task-name">Task: {taskName}</span>}
      </div>
      <div className="right-buttons">
        <button onClick={onZoomOut}>- Zoom</button>
        <button onClick={onZoomIn}>+ Zoom</button>
        <span className="img-count">
          {currentIndex + 1} / {total}
        </span>
      </div>
    </div>
  );
}
