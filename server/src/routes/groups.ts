import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { upload, uploadAny, uploadGroupResource } from '../middleware/upload';
import {
  getGroups,
  createGroup,
  getGroup,
  joinGroup,
  leaveGroup,
  getMyGroups,
  updateGroup,
  getGroupMessages,
  updateGroupCover,
  updateGroupAvatar,
  inviteToGroup,
  getMyInvitations,
  acceptInvitation,
  declineInvitation,
  searchUsersForInvite,
  toggleGroupNotifications,
  transferOwnership,
  getGroupChannels,
  createChannel,
  deleteChannel,
  getChannelMessages,
  uploadGroupFile,
  getGroupFiles,
  deleteGroupFile,
  pinMessage,
  reportMessage,
  awardCeuCredits,
  getPinnedMessages,
  changeMemberRole,
  removeMember,
  banMember,
  unbanMember,
  requestUnban,
  getBanRequests,
  resolveBanRequest,
  deleteGroup,
} from '../controllers/groups.controller';

const router = Router();

router.get('/', authenticate, getGroups);
router.post('/', authenticate, createGroup);
router.get('/me', authenticate, getMyGroups);
router.get('/invitations', authenticate, getMyInvitations);
router.get('/users/search', authenticate, searchUsersForInvite);
router.get('/:id', authenticate, getGroup);
router.put('/:id', authenticate, updateGroup);
router.delete('/:id', authenticate, deleteGroup);
router.post('/:id/join', authenticate, joinGroup);
router.post('/:id/leave', authenticate, leaveGroup);
router.get('/:id/messages', authenticate, getGroupMessages);
router.post('/:id/cover', authenticate, upload.single('cover'), updateGroupCover);
router.post('/:id/avatar', authenticate, upload.single('avatar'), updateGroupAvatar);
router.post('/:id/invite', authenticate, inviteToGroup);
router.post('/:id/notifications', authenticate, toggleGroupNotifications);
router.post('/:id/transfer', authenticate, transferOwnership);
router.get('/:id/channels', authenticate, getGroupChannels);
router.post('/:id/channels', authenticate, upload.single('iconImage'), createChannel);
router.delete('/:id/channels/:channelId', authenticate, deleteChannel);
router.get('/:id/channels/:channelId/messages', authenticate, getChannelMessages);
router.post('/:id/upload', authenticate, uploadGroupResource.single('file'), uploadGroupFile);
router.get('/:id/files', authenticate, getGroupFiles);
router.delete('/:id/files/:fileId', authenticate, deleteGroupFile);
router.get('/:id/pinned', authenticate, getPinnedMessages);
router.patch('/:id/messages/:msgId/pin', authenticate, pinMessage);
router.post('/:id/messages/:msgId/report', authenticate, reportMessage);
router.post('/:id/messages/:msgId/award-ceu', authenticate, awardCeuCredits);
router.patch('/:id/members/:userId/role', authenticate, changeMemberRole);
router.delete('/:id/members/:userId', authenticate, removeMember);
router.post('/:id/members/:userId/ban', authenticate, banMember);
router.delete('/:id/members/:userId/ban', authenticate, unbanMember);
router.get('/:id/ban-requests', authenticate, getBanRequests);
router.post('/:id/request-unban', authenticate, requestUnban);
router.patch('/:id/ban-requests/:userId', authenticate, resolveBanRequest);
router.post('/invitations/:groupId/accept', authenticate, acceptInvitation);
router.post('/invitations/:groupId/decline', authenticate, declineInvitation);

export default router;
