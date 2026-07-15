import { toastAlert } from '../utils/toastAlert';
import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ChatHeaderAvatar } from './ChatHeaderAvatar';
import type { ChatBubble } from '../utils/chatMapping';

type Props = {
  msg: ChatBubble;
  peerName?: string;
  peerAvatarUri?: string;
  onPressAttachment?: (msg: ChatBubble) => void;
  openingAttachment?: boolean;
};

function ReadReceipts(): React.JSX.Element {
  return (
    <Svg width={14} height={10} viewBox="0 0 14 10" fill="none" style={styles.readIcon}>
      <Path d="M1 5.5L3.5 8L7.5 2" stroke="#3480E9" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 5.5L7.5 8L13 2" stroke="#3480E9" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function MessageMeta({ timeLabel, isMine, isRead }: { timeLabel: string; isMine: boolean; isRead?: boolean }): React.JSX.Element {
  return (
    <View style={styles.metaRow}>
      {timeLabel ? <Text style={[styles.metaTime, isMine ? styles.metaTimeMine : styles.metaTimePeer]}>{timeLabel}</Text> : null}
      {isMine && isRead ? <ReadReceipts /> : null}
    </View>
  );
}

export function ChatMessageBubble({
  msg,
  peerName = 'Contact',
  peerAvatarUri,
  onPressAttachment,
  openingAttachment = false,
}: Props): React.JSX.Element {
  const [imageFailed, setImageFailed] = useState(false);
  const isMine = msg.side === 'right';

  const handleAttachmentPress = (): void => {
    if (openingAttachment) {
      return;
    }
    if (onPressAttachment) {
      onPressAttachment(msg);
      return;
    }
    toastAlert('Open file', 'Unable to open this attachment.');
  };

  const bubbleBody = (
    <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubblePeer]}>
      {msg.kind === 'photo' && msg.fileUrl ? (
        <Pressable
          style={styles.photoPressable}
          onPress={handleAttachmentPress}
          disabled={openingAttachment}
          accessibilityRole="button"
          accessibilityLabel="View image"
        >
          {!imageFailed ? (
            <Image
              source={{ uri: msg.fileUrl }}
              style={styles.messageThumb}
              resizeMode="cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <View style={styles.imageFallback}>
              <Text style={styles.imageFallbackText}>Image unavailable</Text>
            </View>
          )}
          {openingAttachment ? (
            <View style={styles.attachmentLoadingOverlay}>
              <ActivityIndicator size="small" color="#3480E9" />
            </View>
          ) : null}
        </Pressable>
      ) : null}

      {msg.kind === 'document' && msg.fileUrl ? (
        <Pressable
          style={styles.documentRow}
          onPress={handleAttachmentPress}
          disabled={openingAttachment}
          accessibilityRole="button"
          accessibilityLabel={`Open ${msg.fileName || 'document'}`}
        >
          {openingAttachment ? (
            <ActivityIndicator size="small" color="#3480E9" />
          ) : (
            <Text style={styles.documentIcon}>📄</Text>
          )}
          <Text style={styles.documentName} numberOfLines={2}>
            {msg.fileName || 'Open document'}
          </Text>
        </Pressable>
      ) : null}

      {msg.kind === 'text' && msg.text ? <Text style={styles.bubbleText}>{msg.text}</Text> : null}

      {msg.kind !== 'text' && msg.text && !/^\[(PHOTO|DOCUMENT)\]/i.test(msg.text) ? (
        <Text style={[styles.bubbleText, styles.captionText]}>{msg.text}</Text>
      ) : null}

      <MessageMeta timeLabel={msg.timeLabel} isMine={isMine} isRead={msg.isRead} />
    </View>
  );

  if (isMine) {
    return <View style={[styles.row, styles.rowMine]}>{bubbleBody}</View>;
  }

  return (
    <View style={[styles.row, styles.rowPeer]}>
      <ChatHeaderAvatar name={peerName} uri={peerAvatarUri} size={34} style={styles.peerAvatar} />
      {bubbleBody}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  rowMine: {
    justifyContent: 'flex-end',
  },
  rowPeer: {
    justifyContent: 'flex-start',
  },
  peerAvatar: {
    marginRight: 8,
    marginBottom: 2,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  bubblePeer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EDF5',
    borderTopLeftRadius: 6,
  },
  bubbleMine: {
    backgroundColor: '#D9EBFF',
    borderTopRightRadius: 6,
  },
  bubbleText: {
    color: '#1F2937',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  captionText: {
    marginTop: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 6,
  },
  metaTime: {
    fontSize: 11,
    fontWeight: '500',
  },
  metaTimePeer: {
    color: '#9CA3AF',
  },
  metaTimeMine: {
    color: '#6B7280',
  },
  readIcon: {
    marginLeft: 2,
  },
  photoPressable: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  messageThumb: {
    width: 168,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  attachmentLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageFallback: {
    width: 168,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  imageFallbackText: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '600',
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 220,
  },
  documentIcon: {
    fontSize: 18,
  },
  documentName: {
    flex: 1,
    color: '#3480E9',
    fontSize: 13,
    fontWeight: '600',
  },
});
