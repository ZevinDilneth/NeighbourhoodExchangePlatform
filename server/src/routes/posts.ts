import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import { getTags, getFeed, getStats, getTrending, getRecentActivity, createPost, getPost, votePost, deletePost, editPost, acceptAnswer, getComments, addComment, deleteComment, rsvpPost, voteComment } from '../controllers/posts.controller';
import { uploadMedia } from '../middleware/upload';

const router = Router();

router.get('/tags', getTags);
router.get('/stats', getStats);
router.get('/trending', getTrending);
router.get('/activity', getRecentActivity);
router.get('/', optionalAuthenticate, getFeed);
router.post('/', authenticate, uploadMedia.array('images', 10), createPost);
router.get('/:id', optionalAuthenticate, getPost);
router.put('/:id', authenticate, uploadMedia.array('images', 10), editPost);
router.put('/:id/vote', authenticate, votePost);
router.delete('/:id', authenticate, deletePost);
router.put('/:id/rsvp', authenticate, rsvpPost);
router.get('/:id/comments', optionalAuthenticate, getComments);
router.post('/:id/comments', authenticate, uploadMedia.array('images', 5), addComment);
router.delete('/:id/comments/:commentId', authenticate, deleteComment);
router.put('/:id/comments/:commentId/vote', authenticate, voteComment);
// Q&A: question author accepts the best answer → awards CEU to the answerer
router.put('/:questionId/accept-answer', authenticate, acceptAnswer);

export default router;
