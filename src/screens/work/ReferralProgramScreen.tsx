import { toastAlert } from '../../utils/toastAlert';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppDrawerParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { portalScreenLayout } from '../../theme/portalScreenLayout';
import { PortalSearchBar } from '../../components/PortalSearchBar';
import { ListFilterSheet } from '../../components/ListFilterSheet';
import { NotificationBellPressable } from '../../components/NotificationBellPressable';
import { PortalProfileHeaderButton } from '../../components/PortalProfileHeaderButton';
import { applyListFilters } from '../../utils/listFiltering';
import type { SortOption } from '../../types/listFilters';
import { DEFAULT_SORT } from '../../types/listFilters';
import { STANDARD_SORT_OPTIONS } from '../../constants/listFilterPresets';

type ReferralRecord = {
  id: string;
  name: string;
  joinedDate: string;
  reward: string;
  status: 'Pending' | 'Rewarded';
};

const REFERRAL_LINK = 'https://harborshield360.com/ref/jane-smith-52';

const REFERRAL_HISTORY: ReferralRecord[] = [
  { id: 'r-1', name: 'Michael Ross', joinedDate: '2026-05-01', reward: '$75', status: 'Rewarded' },
  { id: 'r-2', name: 'Emma Walker', joinedDate: '2026-05-03', reward: '$75', status: 'Pending' },
  { id: 'r-3', name: 'Noah Green', joinedDate: '2026-05-05', reward: '$75', status: 'Pending' },
];

type ShareChannel = { key: string; label: string; bg: string; fg: string };

const SHARE_CHANNELS: ShareChannel[] = [
  { key: 'facebook', label: 'Facebook', bg: '#1877F2', fg: '#FFFFFF' },
  { key: 'instagram', label: 'Instagram', bg: '#E1306C', fg: '#FFFFFF' },
  { key: 'x', label: 'X', bg: '#111827', fg: '#FFFFFF' },
  { key: 'whatsapp', label: 'WhatsApp', bg: '#25D366', fg: '#FFFFFF' },
  { key: 'email', label: 'Email', bg: '#EEF4FF', fg: colors.primary },
];

const REFERRAL_STATUS_OPTIONS = [
  { label: 'Pending', value: 'Pending' },
  { label: 'Rewarded', value: 'Rewarded' },
];

export function ReferralProgramScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<AppDrawerParamList>>();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>(DEFAULT_SORT);
  const [filterOpen, setFilterOpen] = useState(false);

  const filteredReferrals = useMemo(
    () =>
      applyListFilters(REFERRAL_HISTORY, {
        searchQuery,
        searchFields: (item) => [item.name, item.joinedDate, item.reward, item.status],
        statusFilter,
        getStatus: (item) => item.status,
        sort: sortBy,
        getName: (item) => item.name,
        getDate: (item) => item.joinedDate,
      }),
    [searchQuery, sortBy, statusFilter],
  );

  const filterActive = statusFilter != null || sortBy !== DEFAULT_SORT;

  const rewardedTotal = useMemo(() => {
    return REFERRAL_HISTORY.filter((x) => x.status === 'Rewarded').length * 75;
  }, []);

  const onCopyLink = (): void => {
    toastAlert('Referral Link', 'Link copied (mock).');
  };

  const onShare = (channel: string): void => {
    toastAlert('Share', `Share via ${channel} (mock).`);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={portalScreenLayout.chrome}>
        <View style={portalScreenLayout.profileRow}>
          <PortalProfileHeaderButton />
          <NotificationBellPressable style={({ pressed }) => [styles.iconTile, pressed && styles.dim]} />
        </View>

        <View style={styles.searchRow}>
          <Pressable
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
            style={({ pressed }) => [styles.iconTile, pressed && styles.dim]}
          >
            <View style={styles.menuGlyph}>
              <View style={styles.menuLine} />
              <View style={styles.menuLine} />
              <View style={styles.menuLine} />
            </View>
          </Pressable>
          <PortalSearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search referrals by name or status"
            filterActive={filterActive}
            onFilterPress={() => setFilterOpen(true)}
          />
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Referral Program</Text>
          <Text style={styles.heroSub}>Share your link and earn rewards when your referral signs up.</Text>
          <View style={styles.summaryBadge}>
            <Text style={styles.summaryBadgeText}>Total Rewards: ${String(rewardedTotal)}</Text>
          </View>
        </View>

        <View style={styles.linkCard}>
          <Text style={styles.linkCardTitle}>Your Referral Link</Text>
          <View style={styles.linkRow}>
            <Text style={styles.linkText} numberOfLines={1}>
              {REFERRAL_LINK}
            </Text>
            <Pressable style={({ pressed }) => [styles.copyBtn, pressed && styles.dim]} onPress={onCopyLink}>
              <Text style={styles.copyBtnText}>Copy</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.shareSection}>
          <Text style={styles.sectionTitle}>Share Options</Text>
          <View style={styles.shareGrid}>
            {SHARE_CHANNELS.map((channel) => (
              <Pressable
                key={channel.key}
                style={({ pressed }) => [styles.shareChip, { backgroundColor: channel.bg }, pressed && styles.dim]}
                onPress={() => onShare(channel.label)}
              >
                <Text style={[styles.shareChipText, { color: channel.fg }]}>{channel.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Referral History</Text>
          <View style={styles.historyWrap}>
            {filteredReferrals.map((item) => (
              <View key={item.id} style={styles.historyCard}>
                <View style={styles.historyTop}>
                  <Text style={styles.historyName}>{item.name}</Text>
                  <View style={[styles.statusPill, item.status === 'Rewarded' ? styles.statusRewarded : styles.statusPending]}>
                    <Text style={styles.statusText}>{item.status}</Text>
                  </View>
                </View>
                <Text style={styles.historyMeta}>Joined: {item.joinedDate}</Text>
                <Text style={styles.historyReward}>Reward: {item.reward}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      <ListFilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        statusOptions={REFERRAL_STATUS_OPTIONS}
        sortOptions={STANDARD_SORT_OPTIONS}
        initialStatus={statusFilter}
        initialSort={sortBy}
        onApply={({ status, sort }) => {
          setStatusFilter(status);
          setSortBy(sort);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dashboardCanvas },
  profilePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, paddingVertical: 6, paddingLeft: 6, paddingRight: 14 },
  avatarWrap: { width: 36, height: 36, borderRadius: 14, backgroundColor: colors.avatarSoftFill, alignItems: 'center', justifyContent: 'center' },
  avatarGlyph: { color: colors.primaryDark, fontSize: 14, fontWeight: '600' },
  profileName: { fontSize: 16, fontWeight: '600', color: '#4A5568', marginLeft: 10 },
  chevron: { fontSize: 11, color: colors.primary, marginLeft: 6 },
  iconTile: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  menuGlyph: { width: 18, gap: 4 },
  menuLine: { width: 18, height: 2, borderRadius: 2, backgroundColor: colors.textPrimary },
  searchShell: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, paddingLeft: 12, paddingRight: 6, marginLeft: 10, minHeight: 48 },
  searchInput: { flex: 1, fontSize: 13, color: colors.textPrimary, paddingVertical: 10, paddingHorizontal: 8 },
  innerFilterBtn: { width: 36, height: 36, borderRadius: 9, backgroundColor: colors.innerFilterBg, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 },
  heroCard: { backgroundColor: colors.primary, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 16 },
  heroTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  heroSub: { color: '#DFE9FF', fontSize: 13, lineHeight: 18, marginTop: 6 },
  summaryBadge: { marginTop: 12, alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#2D74E8', paddingHorizontal: 12, paddingVertical: 5 },
  summaryBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  linkCard: { marginTop: 12, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E3EAF6', paddingHorizontal: 14, paddingVertical: 12 },
  linkCardTitle: { color: '#1D2D44', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  linkText: { flex: 1, color: '#4F5B73', fontSize: 12 },
  copyBtn: { borderRadius: 10, backgroundColor: '#EEF4FF', paddingHorizontal: 10, paddingVertical: 7 },
  copyBtnText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  shareSection: { marginTop: 14 },
  sectionTitle: { color: '#1D2D44', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  shareGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  shareChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  shareChipText: { fontSize: 12, fontWeight: '700' },
  historySection: { marginTop: 14 },
  historyWrap: { gap: 10 },
  historyCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E3EAF6', paddingHorizontal: 14, paddingVertical: 12 },
  historyTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyName: { color: '#18263F', fontSize: 15, fontWeight: '700' },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusPending: { backgroundColor: '#FFF2DA' },
  statusRewarded: { backgroundColor: '#E8F8EF' },
  statusText: { color: '#394150', fontSize: 11, fontWeight: '700' },
  historyMeta: { marginTop: 8, color: '#6A7489', fontSize: 12 },
  historyReward: { marginTop: 4, color: '#111827', fontSize: 13, fontWeight: '700' },
  dim: { opacity: 0.88 },
});
