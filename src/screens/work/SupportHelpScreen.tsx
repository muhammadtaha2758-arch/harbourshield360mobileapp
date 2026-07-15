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
import { FAQ_CATEGORY_OPTIONS } from '../../constants/listFilterPresets';
import { DEFAULT_SORT } from '../../types/listFilters';
import { matchesSearchQuery } from '../../utils/listFiltering';

type FaqItem = {
  q: string;
  a: string;
  category: string;
};

const FAQ_ITEMS: FaqItem[] = [
  {
    category: 'Account',
    q: 'How do I reset my password?',
    a: 'Click on "Forgot Password" on the login page and follow the steps. You will receive an email with a reset link.',
  },
  {
    category: 'Billing',
    q: 'Where can I view my invoices?',
    a: 'Go to the "Estimates & Invoices" section in your dashboard. All your invoices will be listed there with download options.',
  },
  {
    category: 'Account',
    q: 'How can I update my contact information?',
    a: 'Visit the "Profile" page and click "Edit" to make changes to your contact information. Do not forget to save your changes.',
  },
  {
    category: 'Billing',
    q: 'What payment methods do you accept?',
    a: 'We accept all major credit cards (Visa, MasterCard, American Express), bank transfers, and PayPal.',
  },
  {
    category: 'General',
    q: 'How do I contact customer support?',
    a: 'You can contact us through email at info@harborshield360.com, phone at +1 469-327-8930, or submit a support ticket through this help page.',
  },
  {
    category: 'Account',
    q: 'Can I cancel my subscription?',
    a: 'Yes, you can cancel your subscription at any time. Go to your account settings and select the cancellation option.',
  },
  {
    category: 'Documents',
    q: 'How do I upload documents?',
    a: 'Navigate to the Documents section and click "Upload". You can drag and drop files or use the file browser to select them.',
  },
  {
    category: 'General',
    q: 'What is the warranty period?',
    a: 'Our standard warranty period is 1 year from the date of purchase. Extended warranties are available for additional coverage.',
  },
];

const CATEGORIES = ['General', 'Billing', 'Technical', 'Account', 'Documents'];

export function SupportHelpScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<AppDrawerParamList>>();
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [faqSearch, setFaqSearch] = useState('');
  const [faqCategoryFilter, setFaqCategoryFilter] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const filteredFaq = useMemo(() => {
    return FAQ_ITEMS.filter((item) => {
      const categoryMatch = !faqCategoryFilter || item.category === faqCategoryFilter;
      const searchMatch = matchesSearchQuery(faqSearch, [item.q, item.a, item.category]);
      return categoryMatch && searchMatch;
    });
  }, [faqCategoryFilter, faqSearch]);

  const filterActive = faqCategoryFilter != null;

  const onSubmit = (): void => {
    if (!subject.trim() || !description.trim()) {
      toastAlert('Support Request', 'Please fill Subject and Description.');
      return;
    }
    toastAlert('Support Request', 'Your support request has been submitted.');
    setSubject('');
    setDescription('');
    setCategory(CATEGORIES[0]);
    setCategoryOpen(false);
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
            value={faqSearch}
            onChangeText={setFaqSearch}
            placeholder="Search FAQ topics"
            filterActive={filterActive}
            onFilterPress={() => setFilterOpen(true)}
          />
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Support & Help</Text>
          <Text style={styles.heroSub}>Reach support, explore FAQs, and submit a request in one place.</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Contact Support</Text>
          <ContactRow label="Email Support" value="info@harborshield360.com" />
          <ContactRow label="Phone Support" value="+1 469-327-8930" />
          <ContactRow label="Live Chat" value="Available 9 AM – 6 PM (Mon – Fri)" />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          {filteredFaq.length === 0 ? (
            <Text style={styles.emptyFaq}>No FAQ topics match your search or filter.</Text>
          ) : null}
          {filteredFaq.map((item, idx) => (
            <View key={item.q} style={[styles.faqItem, idx === FAQ_ITEMS.length - 1 && styles.faqItemLast]}>
              <Text style={styles.faqQuestion}>{item.q}</Text>
              <Text style={styles.faqAnswer}>{item.a}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Support Request</Text>

          <Text style={styles.fieldLabel}>Subject</Text>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            placeholder="Enter subject"
            placeholderTextColor="#8A93A7"
            style={styles.fieldInput}
          />

          <Text style={styles.fieldLabel}>Category</Text>
          <View style={styles.selectWrap}>
            <Pressable style={styles.selectButton} onPress={() => setCategoryOpen((v) => !v)}>
              <Text style={styles.selectText}>{category}</Text>
              <Text style={styles.selectChevron}>{categoryOpen ? '▴' : '▾'}</Text>
            </Pressable>
            {categoryOpen ? (
              <View style={styles.selectMenu}>
                {CATEGORIES.map((item) => (
                  <Pressable key={item} style={styles.selectItem} onPress={() => { setCategory(item); setCategoryOpen(false); }}>
                    <Text style={styles.selectItemText}>{item}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your issue..."
            placeholderTextColor="#8A93A7"
            multiline
            style={styles.descriptionInput}
          />

          <Pressable style={({ pressed }) => [styles.submitBtn, pressed && styles.dim]} onPress={onSubmit}>
            <Text style={styles.submitBtnText}>Submit Request</Text>
          </Pressable>
        </View>
      </ScrollView>

      <ListFilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter FAQ"
        statusOptions={FAQ_CATEGORY_OPTIONS}
        sortOptions={[]}
        initialStatus={faqCategoryFilter}
        initialSort={DEFAULT_SORT}
        onApply={({ status }) => setFaqCategoryFilter(status)}
      />
    </SafeAreaView>
  );
}

function ContactRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.contactRow}>
      <Text style={styles.contactLabel}>{label}</Text>
      <Text style={styles.contactValue}>{value}</Text>
    </View>
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
  heroCard: { backgroundColor: colors.primary, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 16, marginBottom: 12 },
  heroTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  heroSub: { color: '#DFE9FF', fontSize: 13, lineHeight: 18, marginTop: 6 },
  sectionCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E3EAF6', paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
  sectionTitle: { color: '#1D2D44', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  contactRow: { marginBottom: 10 },
  contactLabel: { color: '#344054', fontSize: 12, fontWeight: '700' },
  contactValue: { marginTop: 4, color: '#18263F', fontSize: 14, fontWeight: '500' },
  faqItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEF2F8' },
  faqItemLast: { borderBottomWidth: 0 },
  faqQuestion: { color: '#1F2937', fontSize: 14, fontWeight: '700' },
  faqAnswer: { marginTop: 6, color: '#4B5563', fontSize: 13, lineHeight: 18 },
  fieldLabel: { color: '#344054', fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  fieldInput: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#D7E0EE', backgroundColor: '#F9FBFF', color: '#24334E', fontSize: 13, paddingHorizontal: 12, paddingVertical: 10 },
  selectWrap: { position: 'relative' },
  selectButton: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#D7E0EE', backgroundColor: '#F9FBFF', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText: { color: '#24334E', fontSize: 13, fontWeight: '600', flex: 1, paddingRight: 10 },
  selectChevron: { color: '#24334E', fontSize: 12, fontWeight: '700' },
  selectMenu: { marginTop: 5, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE3EE', overflow: 'hidden' },
  selectItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEF2F8' },
  selectItemText: { color: '#344054', fontSize: 13, fontWeight: '500' },
  descriptionInput: { minHeight: 92, borderRadius: 12, borderWidth: 1, borderColor: '#D7E0EE', backgroundColor: '#F9FBFF', color: '#24334E', fontSize: 13, textAlignVertical: 'top', paddingHorizontal: 12, paddingVertical: 10 },
  submitBtn: { marginTop: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  submitBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  dim: { opacity: 0.88 },
});
