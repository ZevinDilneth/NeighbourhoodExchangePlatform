import { Router } from 'express';
import Joi from 'joi';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import {
  sendPhoneVerification,
  verifyPhone,
  updatePhone,
  requestPhoneChange,
} from '../controllers/phone.controller';

const router = Router();

const verifySchema = Joi.object({
  code: Joi.string().length(6).pattern(/^\d+$/).required().messages({
    'string.length': 'Code must be exactly 6 digits',
    'string.pattern.base': 'Code must contain digits only',
  }),
});

const updatePhoneSchema = Joi.object({
  phone: Joi.string().min(8).max(20).required(),
});

// All phone routes require authentication
router.use(authenticate);

router.post('/send-code',      sendPhoneVerification);
router.post('/verify',         validate(verifySchema),      verifyPhone);
router.put('/number',          validate(updatePhoneSchema), updatePhone);
router.post('/change-request', validate(updatePhoneSchema), requestPhoneChange);

export default router;
