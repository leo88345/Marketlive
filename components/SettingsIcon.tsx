import React from 'react';
import { View, StyleSheet } from 'react-native';

interface SettingsIconProps {
  size?: number;
  color?: string;
  style?: any;
}

const SettingsIcon: React.FC<SettingsIconProps> = ({ size = 18, color = '#555', style }) => {
  const toothSize = size * 0.12;
  const gearRadius = size * 0.35;
  const innerRadius = size * 0.15;
  
  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {/* Main gear circle */}
      <View style={[styles.gear, { 
        borderColor: color,
        borderWidth: size * 0.08,
        width: gearRadius * 2,
        height: gearRadius * 2,
        borderRadius: gearRadius,
      }]} />
      
      {/* Inner circle (center hole) */}
      <View style={[styles.innerCircle, {
        backgroundColor: 'transparent',
        borderColor: color,
        borderWidth: size * 0.06,
        width: innerRadius * 2,
        height: innerRadius * 2,
        borderRadius: innerRadius,
      }]} />
      
      {/* 8 gear teeth positioned around the circle */}
      {/* Top tooth */}
      <View style={[styles.tooth, { 
        backgroundColor: color,
        width: toothSize,
        height: toothSize * 1.5,
        top: 0,
        left: (size - toothSize) / 2,
      }]} />
      
      {/* Top-right tooth */}
      <View style={[styles.tooth, { 
        backgroundColor: color,
        width: toothSize * 1.2,
        height: toothSize * 1.2,
        top: size * 0.1,
        right: size * 0.1,
        transform: [{ rotate: '45deg' }],
      }]} />
      
      {/* Right tooth */}
      <View style={[styles.tooth, { 
        backgroundColor: color,
        width: toothSize * 1.5,
        height: toothSize,
        right: 0,
        top: (size - toothSize) / 2,
      }]} />
      
      {/* Bottom-right tooth */}
      <View style={[styles.tooth, { 
        backgroundColor: color,
        width: toothSize * 1.2,
        height: toothSize * 1.2,
        bottom: size * 0.1,
        right: size * 0.1,
        transform: [{ rotate: '45deg' }],
      }]} />
      
      {/* Bottom tooth */}
      <View style={[styles.tooth, { 
        backgroundColor: color,
        width: toothSize,
        height: toothSize * 1.5,
        bottom: 0,
        left: (size - toothSize) / 2,
      }]} />
      
      {/* Bottom-left tooth */}
      <View style={[styles.tooth, { 
        backgroundColor: color,
        width: toothSize * 1.2,
        height: toothSize * 1.2,
        bottom: size * 0.1,
        left: size * 0.1,
        transform: [{ rotate: '45deg' }],
      }]} />
      
      {/* Left tooth */}
      <View style={[styles.tooth, { 
        backgroundColor: color,
        width: toothSize * 1.5,
        height: toothSize,
        left: 0,
        top: (size - toothSize) / 2,
      }]} />
      
      {/* Top-left tooth */}
      <View style={[styles.tooth, { 
        backgroundColor: color,
        width: toothSize * 1.2,
        height: toothSize * 1.2,
        top: size * 0.1,
        left: size * 0.1,
        transform: [{ rotate: '45deg' }],
      }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gear: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  innerCircle: {
    position: 'absolute',
    zIndex: 2,
  },
  tooth: {
    position: 'absolute',
    zIndex: 1,
  },
});

export default SettingsIcon;
