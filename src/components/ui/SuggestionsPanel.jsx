import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { generateSuggestions, dismissSuggestion } from '../../services/suggestionsService';
import { Lightbulb, Phone, Target, Clock, Flame, FileCheck, AlertTriangle, CalendarClock, Trophy, X, ChevronDown, ChevronUp } from 'lucide-react';

const TYPE_ICONS = {
  inactive_contact: Phone,
  stuck_opportunity: Target,
  overdue_tasks: Clock,
  hot_lead_no_activity: Flame,
  expiring_approvals: FileCheck,
  high_value_at_risk: AlertTriangle,
  no_followup: CalendarClock,
  win_streak: Trophy,
};

const PRIORITY_COLORS = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#4A7AAB',
};

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export default function SuggestionsPanel() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();

  const [suggestions, setSuggestions] = useState([]);
  const [collapsed, setCollapsed] = useState(false);

  const refresh = useCallback(() => {
    setSuggestions(generateSuggestions());
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(() => {
      setSuggestions(generateSuggestions(true));
    }, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleDismiss = useCallback((e, suggestion) => {
    e.stopPropagation();
    dismissSuggestion(suggestion);
    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
  }, []);

  const handleAction = useCallback((suggestion) => {
    navigate(suggestion.action_path);
  }, [navigate]);

  if (suggestions.length === 0) return null;

  // Styles
  const panelStyle = {
    marginBottom: 20,
    borderRadius: 14,
    border: `1px solid ${isDark ? 'rgba(74,122,171,0.2)' : 'rgba(74,122,171,0.15)'}`,
    background: isDark ? '#132337' : '#f8fafc',
    overflow: 'hidden',
    transition: 'all 0.2s ease',
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 18px',
    cursor: 'pointer',
    background: isDark ? 'rgba(74,122,171,0.08)' : 'rgba(74,122,171,0.05)',
    borderBottom: collapsed ? 'none' : `1px solid ${isDark ? 'rgba(74,122,171,0.12)' : 'rgba(74,122,171,0.1)'}`,
    userSelect: 'none',
    flexDirection: isRTL ? 'row-reverse' : 'row',
  };

  const headerLeftStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexDirection: isRTL ? 'row-reverse' : 'row',
  };

  const titleStyle = {
    fontSize: 14,
    fontWeight: 600,
    color: isDark ? '#e2e8f0' : '#1e293b',
    margin: 0,
  };

  const badgeStyle = {
    background: '#4A7AAB',
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    borderRadius: 10,
    padding: '2px 8px',
    minWidth: 20,
    textAlign: 'center',
    lineHeight: '18px',
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 12,
    padding: 14,
  };

  return (
    <div style={panelStyle} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div style={headerStyle} onClick={() => setCollapsed(c => !c)}>
        <div style={headerLeftStyle}>
          <Lightbulb size={18} color="#4A7AAB" />
          <span style={titleStyle}>
            {isRTL ? 'اقتراحات ذكية' : 'Smart Suggestions'}
          </span>
          <span style={badgeStyle}>
            {suggestions.length} {isRTL ? 'اقتراح' : suggestions.length === 1 ? 'suggestion' : 'suggestions'}
          </span>
        </div>
        {collapsed
          ? <ChevronDown size={18} color={isDark ? '#94a3b8' : '#64748b'} />
          : <ChevronUp size={18} color={isDark ? '#94a3b8' : '#64748b'} />
        }
      </div>

      {/* Cards */}
      {!collapsed && (
        <div style={gridStyle}>
          {suggestions.map(s => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              isDark={isDark}
              isRTL={isRTL}
              onDismiss={handleDismiss}
              onAction={handleAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SuggestionCard({ suggestion, isDark, isRTL, onDismiss, onAction }) {
  const [hovered, setHovered] = useState(false);
  const Icon = TYPE_ICONS[suggestion.type] || Lightbulb;
  const priorityColor = PRIORITY_COLORS[suggestion.priority] || PRIORITY_COLORS.low;

  const cardStyle = {
    position: 'relative',
    display: 'flex',
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 12,
    padding: '14px 16px',
    borderRadius: 10,
    background: isDark ? '#1a2332' : '#ffffff',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
    transition: 'all 0.15s ease',
    cursor: 'pointer',
    boxShadow: hovered
      ? (isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.08)')
      : 'none',
    transform: hovered ? 'translateY(-1px)' : 'none',
  };

  const iconWrapStyle = {
    width: 36,
    height: 36,
    borderRadius: 8,
    background: `${priorityColor}15`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
  };

  const dotStyle = {
    position: 'absolute',
    top: -2,
    [isRTL ? 'left' : 'right']: -2,
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: priorityColor,
    border: `2px solid ${isDark ? '#1a2332' : '#ffffff'}`,
  };

  const contentStyle = {
    flex: 1,
    minWidth: 0,
    textAlign: isRTL ? 'right' : 'left',
  };

  const cardTitleStyle = {
    fontSize: 13,
    fontWeight: 600,
    color: isDark ? '#e2e8f0' : '#1e293b',
    margin: 0,
    lineHeight: 1.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const descStyle = {
    fontSize: 12,
    color: isDark ? '#94a3b8' : '#64748b',
    margin: '4px 0 0',
    lineHeight: 1.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const actionRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    flexDirection: isRTL ? 'row-reverse' : 'row',
  };

  const actionBtnStyle = {
    fontSize: 11,
    fontWeight: 600,
    color: '#4A7AAB',
    background: 'rgba(74,122,171,0.1)',
    border: 'none',
    borderRadius: 6,
    padding: '4px 10px',
    cursor: 'pointer',
    lineHeight: '18px',
    fontFamily: 'inherit',
  };

  const dismissBtnStyle = {
    position: 'absolute',
    top: 8,
    [isRTL ? 'left' : 'right']: 8,
    width: 22,
    height: 22,
    borderRadius: 6,
    border: 'none',
    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    color: isDark ? '#94a3b8' : '#64748b',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    opacity: hovered ? 1 : 0.5,
    transition: 'opacity 0.15s',
  };

  return (
    <div
      style={cardStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onAction(suggestion)}
    >
      <div style={iconWrapStyle}>
        <div style={dotStyle} />
        <Icon size={16} color={priorityColor} />
      </div>
      <div style={contentStyle}>
        <p style={cardTitleStyle}>
          {isRTL ? suggestion.title_ar : suggestion.title_en}
        </p>
        <p style={descStyle}>
          {isRTL ? suggestion.description_ar : suggestion.description_en}
        </p>
        <div style={actionRowStyle}>
          <button
            style={actionBtnStyle}
            onClick={(e) => { e.stopPropagation(); onAction(suggestion); }}
          >
            {isRTL ? suggestion.action_label_ar : suggestion.action_label_en}
          </button>
        </div>
      </div>
      <button
        style={dismissBtnStyle}
        onClick={(e) => onDismiss(e, suggestion)}
        title={isRTL ? 'تجاهل' : 'Dismiss'}
      >
        <X size={12} />
      </button>
    </div>
  );
}
