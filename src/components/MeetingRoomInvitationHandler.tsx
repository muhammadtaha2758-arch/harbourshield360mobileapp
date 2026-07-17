import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { portalService } from '../services/api/portalService';
import { sessionStorage } from '../services/storage/sessionStorage';
import { toastAlert } from '../utils/toastAlert';
import { navigationRef } from '../navigation/navigationRef';
import { meetingRoomInvitationTokenFromUrl } from '../utils/meetingRoomInvitation';

export function MeetingRoomInvitationHandler(): null {
  const { token, isInitializing } = useAuth();
  const [pendingVersion, setPendingVersion] = useState(0);
  const processingRef = useRef(false);
  const signedOutNoticeShownRef = useRef(false);

  const captureInvitationUrl = useCallback(async (url: string): Promise<void> => {
    const invitationToken = meetingRoomInvitationTokenFromUrl(url);
    if (!invitationToken) {
      return;
    }

    await sessionStorage.setPendingMeetingInvitation(invitationToken);
    setPendingVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    Linking.getInitialURL()
      .then((url) => (url ? captureInvitationUrl(url) : undefined))
      .catch(() => undefined);

    const subscription = Linking.addEventListener('url', ({ url }) => {
      captureInvitationUrl(url).catch(() => undefined);
    });

    return () => subscription.remove();
  }, [captureInvitationUrl]);

  useEffect(() => {
    if (isInitializing || processingRef.current) {
      return;
    }

    const processPendingInvitation = async (): Promise<void> => {
      const invitationToken = await sessionStorage.getPendingMeetingInvitation();
      if (!invitationToken) {
        return;
      }

      if (!token) {
        if (!signedOutNoticeShownRef.current) {
          signedOutNoticeShownRef.current = true;
          toastAlert(
            'Meeting room invitation',
            'Sign in or create an account using the invited email address to join the room.',
          );
        }
        return;
      }

      processingRef.current = true;
      try {
        const result = await portalService.acceptMeetingRoomInvitation(invitationToken);
        await sessionStorage.clearPendingMeetingInvitation();

        const openRoom = (): void => {
          if (!navigationRef.isReady()) {
            setTimeout(openRoom, 150);
            return;
          }
          navigationRef.navigate('AppShell', {
            screen: 'AppTabs',
            params: {
              screen: 'MessagesTab',
              params: {
                screen: 'Chat',
                params: {
                  chatId: `group-${String(result.group.id)}`,
                  name: result.group.name || result.group.title || 'Meeting Room',
                  type: 'group',
                  currentUserId: result.currentUserId,
                  groupId: String(result.group.id),
                },
              },
            },
          });
          toastAlert('Meeting room', result.message || 'You joined the meeting room.');
        };

        openRoom();
      } catch (error) {
        await sessionStorage.clearPendingMeetingInvitation();
        toastAlert(
          'Meeting room invitation',
          error instanceof Error ? error.message : 'Unable to accept this invitation.',
        );
      } finally {
        processingRef.current = false;
      }
    };

    processPendingInvitation().catch(() => {
      processingRef.current = false;
    });
  }, [isInitializing, pendingVersion, token]);

  return null;
}
