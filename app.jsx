import React, { useState, useEffect } from 'react';
import { Browser } from '@capacitor/browser';

// ==========================================
// 1. DEFAULT SETTINGS & MONOCHROMATIC THEME
// ==========================================
const defaultSettings = {
  fontMain: 'sans',
  apiKey: '',
  theme: {
    bg: '#000000',          // AMOLED Black
    surface: '#121212',     // Slightly lighter for navbar
    border: '#2a2a2a',      // Subtle borders
    text: '#ffffff',        // Bold White
    textDim: '#888888',     // Gray for snippets and empty states
    accent: '#ffffff',      // White accents
    cardBg: '#0a0a0a'       // Very dark gray for result cards
  }
};

export default function BrowserApp() {
  const [activeView, setActiveView] = useState('browser'); // 'browser' | 'settings'
  const [settings, setSettings] = useState(defaultSettings);
  
  // Tab State tracks whether a tab is showing a 'search' or an external 'url'
  const [tabs, setTabs] = useState([
    { id: 1, type: 'search', query: '', url: '', title: 'New Tab', inputUrl: '', results: null, isLoading: false, error: null }
  ]);
  const [activeTabId, setActiveTabId] = useState(1);
  const [tabCounter, setTabCounter] = useState(1);

  // Load Settings from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('mono_browser_settings');
    if (saved) {
      try {
        setSettings({ ...defaultSettings, ...JSON.parse(saved) });
      } catch (e) {
        console.error("Failed to load settings", e);
      }
    }
  }, []);

  const saveSettings = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('mono_browser_settings', JSON.stringify(newSettings));
  };

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  // ==========================================
  // 2. TAB MANAGEMENT
  // ==========================================
  const updateTab = (id, updates) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const createTab = (initialData = {}) => {
    const newId = tabCounter + 1;
    setTabCounter(newId);
    setTabs([...tabs, { 
      id: newId, type: 'search', query: '', url: '', title: 'New Tab', 
      inputUrl: '', results: null, isLoading: false, error: null, ...initialData 
    }]);
    setActiveTabId(newId);
  };

  const closeTab = (id, e) => {
    e.stopPropagation();
    const newTabs = tabs.filter(t => t.id !== id);
    if (newTabs.length === 0) {
      createTab();
    } else {
      setTabs(newTabs);
      if (activeTabId === id) setActiveTabId(newTabs[newTabs.length - 1].id);
    }
  };

  // ==========================================
  // 3. CAPACITOR URL BROWSER & SERPER SEARCH
  // ==========================================
  const handleOmniboxSubmit = async (e) => {
    e.preventDefault();
    const query = activeTab.inputUrl.trim();
    if (!query) return;

    // Basic heuristic to check if the user typed a URL (e.g., github.com)
    const isUrl = query.includes('.') && !query.includes(' ') && !query.startsWith('?');

    if (isUrl) {
      let finalUrl = query;
      if (!query.startsWith('http://') && !query.startsWith('https://')) {
        finalUrl = `https://${query}`;
      }
      
      // Update tab UI to reflect the external URL
      updateTab(activeTabId, { type: 'url', url: finalUrl, title: finalUrl });
      
      // Open securely in Capacitor Native Browser (Bypasses iframe restrictions)
      await Browser.open({ url: finalUrl });

    } else {
      // Treat as a search query
      updateTab(activeTabId, { 
        type: 'search', query: query, title: `${query} - Search`, 
        isLoading: true, error: null, results: null 
      });
      fetchSearchResults(query, activeTabId);
    }
  };

  const fetchSearchResults = async (query, tabId) => {
    if (!settings.apiKey) {
      updateTab(tabId, { isLoading: false, error: 'Please enter your Serper.dev API key in Settings.' });
      return;
    }

    try {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': settings.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ q: query })
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const data = await response.json();
      
      updateTab(tabId, { isLoading: false, results: data.organic || [] });
    } catch (err) {
      updateTab(tabId, { isLoading: false, error: err.message });
    }
  };

  // Open a search result natively
  const handleResultClick = async (url) => {
    await Browser.open({ url });
  };

  // ==========================================
  // 4. UI RENDERING
  // ==========================================
  return (
    <div style={{ 
      display: 'flex', flexDirection: 'column', height: '100vh', 
      backgroundColor: settings.theme.bg, color: settings.theme.text, 
      fontFamily: settings.fontMain === 'mono' ? 'monospace' : 'sans-serif' 
    }}>
      
      {/* HEADER & OMNIBOX */}
      <header style={{ 
        display: 'flex', alignItems: 'center', padding: '12px 16px', 
        backgroundColor: settings.theme.surface, borderBottom: `1px solid ${settings.theme.border}` 
      }}>
        <form onSubmit={handleOmniboxSubmit} style={{ flex: 1, display: 'flex' }}>
          <input 
            type="text" 
            value={activeTab?.inputUrl || ''}
            onChange={(e) => updateTab(activeTabId, { inputUrl: e.target.value })}
            placeholder="Search or type a URL..."
            style={{ 
              flex: 1, padding: '12px 20px', borderRadius: '24px', 
              backgroundColor: settings.theme.bg, border: `1px solid ${settings.theme.border}`, 
              color: settings.theme.text, outline: 'none', fontSize: '15px' 
            }}
          />
        </form>
        <button 
          onClick={() => setActiveView(activeView === 'settings' ? 'browser' : 'settings')} 
          style={{ 
            background: 'transparent', border: 'none', color: settings.theme.text, 
            fontSize: '20px', cursor: 'pointer', marginLeft: '16px', padding: '8px'
          }}
        >
          {activeView === 'settings' ? '✕' : '⚙️'}
        </button>
      </header>

      {/* TAB STRIP */}
      <div style={{ 
        display: 'flex', overflowX: 'auto', backgroundColor: settings.theme.bg, 
        borderBottom: `1px solid ${settings.theme.border}`, padding: '8px 8px 0 8px' 
      }}>
        {tabs.map(t => (
          <div 
            key={t.id} 
            onClick={() => setActiveTabId(t.id)} 
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', 
              backgroundColor: t.id === activeTabId ? settings.theme.surface : 'transparent', 
              borderTopLeftRadius: '12px', borderTopRightRadius: '12px', 
              border: `1px solid ${settings.theme.border}`, borderBottom: 'none', 
              cursor: 'pointer', minWidth: '140px', maxWidth: '220px' 
            }}
          >
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px', fontWeight: t.id === activeTabId ? 'bold' : 'normal' }}>
              {t.title}
            </span>
            <button 
              onClick={(e) => closeTab(t.id, e)} 
              style={{ background: 'none', border: 'none', color: settings.theme.textDim, cursor: 'pointer', fontSize: '14px' }}
            >
              ✕
            </button>
          </div>
        ))}
        <button 
          onClick={() => createTab()} 
          style={{ background: 'none', border: 'none', color: settings.theme.text, padding: '0 16px', cursor: 'pointer', fontSize: '24px' }}
        >
          +
        </button>
      </div>

      {/* MAIN VIEWPORT */}
      <main style={{ flex: 1, position: 'relative', overflowY: 'auto' }}>
        
        {/* BROWSER & SEARCH VIEWS */}
        {tabs.map(t => (
          <div key={t.id} style={{ display: (activeView === 'browser' && t.id === activeTabId) ? 'block' : 'none', height: '100%' }}>
            
            {/* INITIAL / EMPTY STATE */}
            {!t.query && !t.url && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: settings.theme.textDim }}>
                <h2 style={{ color: settings.theme.text, marginBottom: '8px' }}>Nocturne Mobile</h2>
                <p>Type a search query or domain to begin.</p>
              </div>
            )}

            {/* SEARCH RESULTS STATE */}
            {t.type === 'search' && t.query && (
              <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 20px', paddingBottom: '100px' }}>
                {t.isLoading && <p style={{ color: settings.theme.textDim, textAlign: 'center' }}>Searching...</p>}
                {t.error && <p style={{ color: '#ff6b6b', textAlign: 'center' }}>{t.error}</p>}
                
                {t.results && t.results.length === 0 && <p style={{ color: settings.theme.textDim, textAlign: 'center' }}>No results found.</p>}
                {t.results && t.results.map((res, idx) => (
                  <div key={idx} onClick={() => handleResultClick(res.link)} style={{ 
                    backgroundColor: settings.theme.cardBg, border: `1px solid ${settings.theme.border}`, 
                    borderRadius: '16px', padding: '20px', marginBottom: '16px', cursor: 'pointer' 
                  }}>
                    <div style={{ fontSize: '12px', color: settings.theme.textDim, marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {res.link}
                    </div>
                    <div style={{ fontSize: '18px', color: settings.theme.accent, textDecoration: 'none', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                      {res.title}
                    </div>
                    <div style={{ fontSize: '14px', color: settings.theme.textDim, lineHeight: '1.5' }}>
                      {res.snippet}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* DIRECT URL STATE (Native Browser Overlay Placeholder) */}
            {t.type === 'url' && t.url && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <p style={{ color: settings.theme.textDim, marginBottom: '20px' }}>Site opened in native Android browser.</p>
                <button 
                  onClick={() => Browser.open({ url: t.url })}
                  style={{ 
                    padding: '12px 24px', backgroundColor: settings.theme.surface, 
                    color: settings.theme.text, border: `1px solid ${settings.theme.border}`, 
                    borderRadius: '24px', cursor: 'pointer', fontWeight: 'bold' 
                  }}
                >
                  Reopen {t.title}
                </button>
              </div>
            )}
          </div>
        ))}

        {/* SETTINGS VIEW */}
        {activeView === 'settings' && (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: settings.theme.bg, padding: '40px' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <h1 style={{ borderBottom: `1px solid ${settings.theme.border}`, paddingBottom: '16px', marginBottom: '32px' }}>Settings</h1>
              
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ marginBottom: '8px' }}>Serper.dev API Key</h3>
                <p style={{ fontSize: '12px', color: settings.theme.textDim, marginBottom: '12px' }}>Required to fetch custom Google search results natively in the UI.</p>
                <input 
                  type="password" 
                  value={settings.apiKey}
                  onChange={(e) => saveSettings({...settings, apiKey: e.target.value})}
                  placeholder="Paste API key here..."
                  style={{ 
                    width: '100%', padding: '14px', borderRadius: '12px', 
                    backgroundColor: settings.theme.surface, color: settings.theme.text, 
                    border: `1px solid ${settings.theme.border}`, outline: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ marginBottom: '12px' }}>Typography</h3>
                <select 
                  value={settings.fontMain} 
                  onChange={(e) => saveSettings({...settings, fontMain: e.target.value})}
                  style={{ 
                    width: '100%', padding: '14px', borderRadius: '12px', 
                    backgroundColor: settings.theme.surface, color: settings.theme.text, 
                    border: `1px solid ${settings.theme.border}`, outline: 'none', cursor: 'pointer'
                  }}
                >
                  <option value="sans">Modern Sans-Serif</option>
                  <option value="mono">Monospace / Hacker</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}