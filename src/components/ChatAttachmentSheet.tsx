import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors } from '../theme/colors';

export type ChatAttachmentChoice = 'camera' | 'library' | 'document';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (choice: ChatAttachmentChoice) => void;
};

type Step = 'root' | 'photo';

function PhotoIcon(): React.JSX.Element {
  return (
    <View style={styles.iconBubble}>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path
          d="M4 7h3l2-2h6l2 2h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2z"
          stroke={colors.primary}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M12 17a4 4 0 100-8 4 4 0 000 8z"
          stroke={colors.primary}
          strokeWidth={1.8}
        />
      </Svg>
    </View>
  );
}

function DocumentIcon(): React.JSX.Element {
  return (
    <View style={styles.iconBubble}>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path
          d="M14 2H7a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V8l-5-6z"
          stroke={colors.primary}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path d="M14 2v6h6" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M9 13h6M9 17h6" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function CameraIcon(): React.JSX.Element {
  return (
    <View style={styles.iconBubble}>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Rect x="3" y="7" width="18" height="13" rx="2" stroke={colors.primary} strokeWidth={1.8} />
        <Path d="M8 7l1.5-3h5L16 7" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M12 16a3 3 0 100-6 3 3 0 000 6z" stroke={colors.primary} strokeWidth={1.8} />
      </Svg>
    </View>
  );
}

function LibraryIcon(): React.JSX.Element {
  return (
    <View style={styles.iconBubble}>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path
          d="M4 5h11a2 2 0 012 2v12H6a2 2 0 01-2-2V5z"
          stroke={colors.primary}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
        <Path d="M17 8h3v11a2 2 0 01-2 2h-1" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" />
        <Path d="M8 14l2.5-3 2 2.5L15 10l3 4" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

export function ChatAttachmentSheet({ visible, onClose, onSelect }: Props): React.JSX.Element {
  const [step, setStep] = useState<Step>('root');

  useEffect(() => {
    if (!visible) {
      setStep('root');
    }
  }, [visible]);

  const choose = (choice: ChatAttachmentChoice): void => {
    onClose();
    // Let the sheet dismiss before opening native camera / library / file picker.
    setTimeout(() => onSelect(choice), 180);
  };

  const handleRequestClose = (): void => {
    if (step === 'photo') {
      setStep('root');
      return;
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleRequestClose}>
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={handleRequestClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <SafeAreaView edges={['bottom']} style={styles.sheetSafe}>
          <View style={styles.sheet}>
            <View style={styles.handle} />

            {step === 'root' ? (
              <>
                <Text style={styles.heading}>Add attachment</Text>
                <Text style={styles.subheading}>Share a photo or document in this conversation.</Text>

                <View style={styles.actions}>
                  <Pressable
                    style={({ pressed }) => [styles.actionRow, pressed && styles.rowPressed]}
                    onPress={() => setStep('photo')}
                    accessibilityRole="button"
                    accessibilityLabel="Photo"
                  >
                    <PhotoIcon />
                    <View style={styles.actionTextCol}>
                      <Text style={styles.actionTitle}>Photo</Text>
                      <Text style={styles.actionSubtitle}>Take a new picture or choose from your library</Text>
                    </View>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [styles.actionRow, styles.actionRowLast, pressed && styles.rowPressed]}
                    onPress={() => choose('document')}
                    accessibilityRole="button"
                    accessibilityLabel="Document"
                  >
                    <DocumentIcon />
                    <View style={styles.actionTextCol}>
                      <Text style={styles.actionTitle}>Document</Text>
                      <Text style={styles.actionSubtitle}>Upload a PDF or other file (max 10MB)</Text>
                    </View>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.heading}>Add photo</Text>
                <Text style={styles.subheading}>Choose how you want to add a photo.</Text>

                <View style={styles.actions}>
                  <Pressable
                    style={({ pressed }) => [styles.actionRow, pressed && styles.rowPressed]}
                    onPress={() => choose('camera')}
                    accessibilityRole="button"
                    accessibilityLabel="Take photo"
                  >
                    <CameraIcon />
                    <View style={styles.actionTextCol}>
                      <Text style={styles.actionTitle}>Take photo</Text>
                      <Text style={styles.actionSubtitle}>Use your camera to capture a new image</Text>
                    </View>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [styles.actionRow, styles.actionRowLast, pressed && styles.rowPressed]}
                    onPress={() => choose('library')}
                    accessibilityRole="button"
                    accessibilityLabel="Choose from library"
                  >
                    <LibraryIcon />
                    <View style={styles.actionTextCol}>
                      <Text style={styles.actionTitle}>Choose from library</Text>
                      <Text style={styles.actionSubtitle}>Select an existing photo from your device</Text>
                    </View>
                  </Pressable>
                </View>
              </>
            )}

            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.rowPressed]}
              onPress={handleRequestClose}
              accessibilityRole="button"
              accessibilityLabel={step === 'photo' ? 'Back' : 'Cancel'}
            >
              <Text style={styles.cancelText}>{step === 'photo' ? 'Back' : 'Cancel'}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheetSafe: {
    width: '100%',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D0D5DD',
    marginBottom: 14,
  },
  heading: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subheading: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginBottom: 14,
  },
  actions: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8EEF6',
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8EEF6',
  },
  actionRowLast: {
    borderBottomWidth: 0,
  },
  rowPressed: {
    backgroundColor: '#F3F6FB',
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextCol: {
    flex: 1,
    gap: 3,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  actionSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  cancelBtn: {
    borderRadius: 14,
    backgroundColor: '#F3F6FB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
