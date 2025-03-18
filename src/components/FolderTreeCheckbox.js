// src/components/FolderTreeCheckbox.js
import React, { useState } from 'react';
import './FolderTreeCheckbox.css';

export default function FolderTreeCheckbox({ node, onToggle, parentPath = '' }) {
    const [expanded, setExpanded] = useState(true);
    const [checked, setChecked] = useState(false);
    const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;

    const handleCheckboxChange = (e) => {
        const newChecked = e.target.checked;
        setChecked(newChecked);
        onToggle(currentPath, newChecked);
    };

    const hasChildren =
        node.type === 'folder' && node.children && node.children.length > 0;

    return (
        <div className="folder-tree-checkbox-node">
            <div className="folder-tree-checkbox-label">
                {node.type === 'folder' && (
                    <>
                        <span className="toggle-icon" onClick={() => setExpanded(!expanded)}>
                            {expanded ? '⌄' : '>'}
                        </span>
                        <input type="checkbox" checked={checked} onChange={handleCheckboxChange} />
                    </>
                )}
                <span>{node.name}</span>
            </div>
            {expanded && hasChildren && (
                <div className="folder-tree-checkbox-children">
                    {node.children.map((child, index) => (
                        <FolderTreeCheckbox
                            key={index}
                            node={child}
                            onToggle={onToggle}
                            parentPath={currentPath}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
