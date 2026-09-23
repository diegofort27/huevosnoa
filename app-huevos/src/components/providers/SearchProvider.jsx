'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

const SearchContext = createContext();

export function SearchProvider({ children }) {
    const [searchTerm, setSearchTerm] = useState('');
    const pathname = usePathname();

    // Clear search when navigating to a different page
    useEffect(() => {
        setSearchTerm('');
    }, [pathname]);

    return (
        <SearchContext.Provider value={{ searchTerm, setSearchTerm }}>
            {children}
        </SearchContext.Provider>
    );
}

export function useSearch() {
    const context = useContext(SearchContext);
    if (!context) {
        throw new Error('useSearch must be used within a SearchProvider');
    }
    return context;
}
