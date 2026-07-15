import { StyleSheet } from 'react-native';
import { colors } from './colors';

/** Top spacing for profile + notification row below the status bar / safe area */
export const PORTAL_HEADER_TOP_PADDING = 12;

export const portalScreenLayout = StyleSheet.create({
  chrome: {
    backgroundColor: colors.headerCanvas,
    paddingHorizontal: 16,
    paddingTop: PORTAL_HEADER_TOP_PADDING,
    paddingBottom: 14,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
});
