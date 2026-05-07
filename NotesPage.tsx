import { useState } from 'react';
import SearchHome from '../components/SearchHome';
import ResultsPage from '../components/ResultsPage';

export default function WebSearchPage() {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [isDark, setIsDark] = useState(false);

  const handleSearch = (q: string) => {
    setQuery(q);
  };

  const handleGoHome = () => {
    setQuery('');
  };

  if (query) {
    return (
      <ResultsPage
        query={query}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSearch={handleSearch}
        onGoHome={handleGoHome}
        isDark={isDark}
        onToggleDark={setIsDark}
      />
    );
  }

  return (
    <SearchHome
      onSearch={handleSearch}
      isDark={isDark}
      onToggleDark={setIsDark}
    />
  );
}
