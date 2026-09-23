'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export default function DataTable({
    columns,
    data,
    onRowClick,
    emptyMessage = 'No data available',
    defaultSort = { key: null, direction: 'desc' }
}) {
    const [sortConfig, setSortConfig] = useState(defaultSort);

    const handleSort = (key) => {
        let direction = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const sortedData = useMemo(() => {
        if (!sortConfig.key) return data;

        return [...data].sort((a, b) => {
            let aValue = a[sortConfig.key];
            let bValue = b[sortConfig.key];

            // Handle special cases like nested properties or custom render data if needed
            // But usually we sort by the raw data key
            
            if (aValue === bValue) return 0;
            
            if (aValue === null || aValue === undefined) return 1;
            if (bValue === null || bValue === undefined) return -1;

            if (typeof aValue === 'string') {
                return sortConfig.direction === 'asc' 
                    ? aValue.localeCompare(bValue)
                    : bValue.localeCompare(aValue);
            }

            return sortConfig.direction === 'asc' 
                ? aValue - bValue 
                : bValue - aValue;
        });
    }, [data, sortConfig]);

    if (!data || data.length === 0) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon">📭</div>
                <h3 className="empty-state-title">{emptyMessage}</h3>
            </div>
        );
    }

    const parentRef = useRef(null);

    // Dynamic height based on window to make it fit well
    const [containerHeight, setContainerHeight] = useState('600px');
    
    useEffect(() => {
        const updateHeight = () => {
            // Take 70% of viewport height roughly
            setContainerHeight(`${Math.max(400, window.innerHeight * 0.7)}px`);
        };
        updateHeight();
        window.addEventListener('resize', updateHeight);
        return () => window.removeEventListener('resize', updateHeight);
    }, []);

    const rowVirtualizer = useVirtualizer({
        count: sortedData.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 52, // Default row height estimation
        overscan: 10, // Render 10 items outside of view
    });

    const virtualItems = rowVirtualizer.getVirtualItems();
    
    // Calculate padding for native table virtualization
    const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
    const paddingBottom = virtualItems.length > 0
        ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
        : 0;

    return (
        <div 
            className="table-container" 
            ref={parentRef} 
            style={{ 
                height: containerHeight, 
                overflow: 'auto',
                position: 'relative' 
            }}
        >
            <table className="table" style={{ width: '100%' }}>
                <thead>
                    <tr>
                        {columns.map((col) => (
                            <th 
                                key={col.key} 
                                onClick={() => col.key !== 'action' && handleSort(col.key)}
                                style={{ 
                                    cursor: col.key !== 'action' ? 'pointer' : 'default',
                                    userSelect: 'none',
                                    position: 'sticky',
                                    top: 0,
                                    zIndex: 10,
                                    backgroundColor: 'var(--bg-card)'
                                }}
                                className={`${col.key !== 'action' ? 'sortable' : ''} ${sortConfig.key === col.key ? 'sorted' : ''}`}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    {col.label}
                                    {sortConfig.key === col.key && (
                                        <span style={{ fontSize: '10px' }}>
                                            {sortConfig.direction === 'asc' ? '▲' : '▼'}
                                        </span>
                                    )}
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {paddingTop > 0 && (
                        <tr><td style={{ height: `${paddingTop}px`, padding: 0, border: 0 }} colSpan={columns.length} /></tr>
                    )}
                    {virtualItems.map((virtualRow) => {
                        const row = sortedData[virtualRow.index];
                        return (
                            <tr
                                key={row.id || virtualRow.index}
                                data-index={virtualRow.index}
                                ref={rowVirtualizer.measureElement}
                                onClick={() => onRowClick && onRowClick(row)}
                                style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                            >
                                {columns.map((col) => (
                                    <td key={col.key}>
                                        {col.render ? col.render(row[col.key], row) : row[col.key]}
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                    {paddingBottom > 0 && (
                        <tr><td style={{ height: `${paddingBottom}px`, padding: 0, border: 0 }} colSpan={columns.length} /></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
