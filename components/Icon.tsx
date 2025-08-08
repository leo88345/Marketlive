import React from 'react';
import { Text, StyleSheet } from 'react-native';

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: any;
}

const Icon: React.FC<IconProps> = ({ name, size = 20, color = '#666', style }) => {
  const getIconSymbol = (iconName: string): string => {
    switch (iconName) {
      case 'settings':
        return '⚙️'; // Gear with color
      case 'gear':
        return '⚙';
      case 'cog':
        return '⚙';
      case 'settings-alt':
        return '⛭'; // Alternative settings symbol
      case 'preferences':
        return '⚙';
      case 'config':
        return '🔧'; // Wrench tool
      case 'notification':
        return '🔔';
      case 'bell':
        return '🔔';
      case 'search':
        return '🔍';
      case 'close':
        return '✕';
      case 'check':
        return '✓';
      case 'arrow-right':
        return '→';
      case 'arrow-left':
        return '←';
      case 'arrow-up':
        return '↑';
      case 'arrow-down':
        return '↓';
      case 'plus':
        return '+';
      case 'minus':
        return '−';
      case 'heart':
        return '♥';
      case 'star':
        return '★';
      case 'info':
        return 'ⓘ';
      case 'warning':
        return '⚠';
      case 'error':
        return '⚠';
      case 'success':
        return '✓';
      case 'menu':
        return '☰';
      case 'home':
        return '⌂';
      case 'user':
        return '👤';
      case 'edit':
        return '✎';
      case 'delete':
        return '🗑';
      case 'share':
        return '↗';
      case 'download':
        return '↓';
      case 'upload':
        return '↑';
      case 'refresh':
        return '↻';
      case 'play':
        return '▶';
      case 'pause':
        return '⏸';
      case 'stop':
        return '⏹';
      case 'volume':
        return '🔊';
      case 'mute':
        return '🔇';
      case 'calendar':
        return '📅';
      case 'clock':
        return '🕐';
      case 'location':
        return '📍';
      case 'phone':
        return '📞';
      case 'email':
        return '✉';
      case 'link':
        return '🔗';
      case 'lock':
        return '🔒';
      case 'unlock':
        return '🔓';
      case 'eye':
        return '👁';
      case 'eye-off':
        return '🙈';
      default:
        return iconName; // Return the name as-is if no match
    }
  };

  return (
    <Text 
      style={[
        styles.icon, 
        { fontSize: size, color }, 
        style
      ]}
    >
      {getIconSymbol(name)}
    </Text>
  );
};

const styles = StyleSheet.create({
  icon: {
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});

export default Icon;
