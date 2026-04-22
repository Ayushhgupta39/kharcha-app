import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'home'
  | 'list'
  | 'chart'
  | 'settings'
  | 'search'
  | 'filter'
  | 'plus'
  | 'arrow-l'
  | 'arrow-r'
  | 'check'
  | 'x'
  | 'sms'
  | 'bell'
  | 'edit'
  | 'trash'
  | 'calendar'
  | 'chevron-r'
  | 'chevron-d'
  | 'chevron-l'
  | 'chevron-u'
  | 'shield'
  | 'lock'
  | 'sparkle'
  | 'zap';

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function Icon({
  name,
  size = 18,
  color = '#F5F5F5',
  strokeWidth = 1.5,
}: Props) {
  const p = {
    stroke: color,
    strokeWidth,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'home':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z" />
        </Svg>
      );
    case 'list':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </Svg>
      );
    case 'chart':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M3 3v18h18M7 14l4-4 4 4 5-5" />
        </Svg>
      );
    case 'settings':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle {...p} cx="12" cy="12" r="3" />
          <Path
            {...p}
            d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
          />
        </Svg>
      );
    case 'search':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle {...p} cx="11" cy="11" r="7" />
          <Path {...p} d="M21 21l-4.3-4.3" />
        </Svg>
      );
    case 'filter':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M3 6h18M6 12h12M10 18h4" />
        </Svg>
      );
    case 'plus':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} strokeWidth={strokeWidth ?? 2.2} d="M12 5v14M5 12h14" />
        </Svg>
      );
    case 'arrow-l':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M19 12H5M12 19l-7-7 7-7" />
        </Svg>
      );
    case 'arrow-r':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M5 12h14M12 5l7 7-7 7" />
        </Svg>
      );
    case 'check':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M20 6L9 17l-5-5" />
        </Svg>
      );
    case 'x':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M18 6L6 18M6 6l12 12" />
        </Svg>
      );
    case 'sms':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            {...p}
            d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
          />
        </Svg>
      );
    case 'bell':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            {...p}
            d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"
          />
        </Svg>
      );
    case 'edit':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            {...p}
            d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"
          />
        </Svg>
      );
    case 'trash':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            {...p}
            d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
          />
        </Svg>
      );
    case 'calendar':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect {...p} x="3" y="4" width="18" height="18" rx="2" />
          <Path {...p} d="M16 2v4M8 2v4M3 10h18" />
        </Svg>
      );
    case 'chevron-r':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M9 6l6 6-6 6" />
        </Svg>
      );
    case 'chevron-d':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M6 9l6 6 6-6" />
        </Svg>
      );
    case 'chevron-l':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M15 18l-6-6 6-6" />
        </Svg>
      );
    case 'chevron-u':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M18 15l-6-6-6 6" />
        </Svg>
      );
    case 'shield':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </Svg>
      );
    case 'lock':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect {...p} x="3" y="11" width="18" height="11" rx="2" />
          <Path {...p} d="M7 11V7a5 5 0 0 1 10 0v4" />
        </Svg>
      );
    case 'sparkle':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />
        </Svg>
      );
    case 'zap':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M13 2L3 14h9l-1 8 10-12h-9z" />
        </Svg>
      );
    default:
      return null;
  }
}
