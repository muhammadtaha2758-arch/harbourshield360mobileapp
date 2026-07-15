export type AppDrawerParamList = {
  AppTabs: undefined;
  Agreements: undefined;
};

export type AppTabParamList = {
  DashboardTab: undefined;
  ScheduleTab: undefined;
  ProjectsTab: undefined;
  MessagesTab: undefined;
  PhotosMediaTab: undefined;
  ProfileTab: undefined;
  EstimatesInvoicesTab: undefined;
  DocumentsTab: undefined;
  ServiceRequestsTab: undefined;
  FinancingTab: undefined;
};

export type AgreementsStackParamList = {
  AgreementsList: undefined;
  AgreementDetail: { agreementId: string };
};

export type ProjectDetailParams = {
  projectId?: string;
  title: string;
  status?: string;
  description?: string;
};

export type ProjectsStackParamList = {
  ProjectsList: undefined;
  ProjectDetail: ProjectDetailParams;
};

export type ChatParams = {
  chatId: string;
  name: string;
  type: 'direct' | 'group';
  currentUserId: string;
  peerUserId?: string;
  groupId?: string;
  /** Optional profile photo URL; when omitted ChatScreen uses a name-based placeholder. */
  avatarUri?: string;
};

export type MessagesStackParamList = {
  MessagesList: undefined;
  Chat: ChatParams;
};

export type LoginParams = {
  /** Pre-fill email after signup when verification is required. */
  pendingVerificationEmail?: string;
};

export type AppRootStackParamList = {
  Login: LoginParams | undefined;
  SignUp: undefined;
  AppShell: undefined;
};
