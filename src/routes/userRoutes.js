import express from 'express';
import * as userController from '../controllers/userController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/login', userController.login);
router.post('/logout', userController.logout);
router.post('/signup', userController.signup);

router.get('/me', requireAuth, userController.getMe);
router.get('/me/cards', requireAuth, userController.getMyCards);
router.get('/me/listings', requireAuth, userController.getMyListings);

router.get('/auth/google', userController.getAuthGoogle);
router.get('/auth/google/callback', userController.getAuthGoogleCallback);

export default router;
