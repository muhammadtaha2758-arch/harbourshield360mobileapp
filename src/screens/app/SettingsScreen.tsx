import { toastAlert } from '../../utils/toastAlert';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/AppButton';
import { LogoutConfirmModal } from '../../components/LogoutConfirmModal';
import { InfoCard } from '../../components/InfoCard';
import { ScreenContainer } from '../../components/ScreenContainer';
import { useAuth } from '../../context/AuthContext';
import { customerService } from '../../services/api/customerService';
import { colors } from '../../theme/colors';

export function SettingsScreen(): React.JSX.Element {
  const { logout } = useAuth();
  const [settingsCount, setSettingsCount] = useState('0');
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  useEffect(() => {
    const loadSettings = async (): Promise<void> => {
      try {
        const settings = await customerService.getSettings();
        setSettingsCount(String(Object.keys(settings).length));
      } catch (error) {
        toastAlert('Settings', error instanceof Error ? error.message : 'Unable to fetch settings.');
      }
    };

    loadSettings().catch(() => {
      setSettingsCount('0');
    });
  }, []);

  const confirmLogout = useCallback(async () => {
    setLogoutModalVisible(false);
    try {
      await logout();
    } catch (error) {
      toastAlert('Logout', error instanceof Error ? error.message : 'Unable to logout.');
    }
  }, [logout]);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>
      <InfoCard title="Fetched settings keys" value={settingsCount} />
      <AppButton title="Logout" onPress={() => setLogoutModalVisible(true)} />
      <LogoutConfirmModal
        visible={logoutModalVisible}
        onCancel={() => setLogoutModalVisible(false)}
        onConfirm={() => {
          void confirmLogout();
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 10,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
});
