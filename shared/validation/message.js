import { createValidator } from './index.js';
import { MESSAGE_ROLES } from '../constants.js';

export const messageRules = {
    role: {
        required: true,
        type: 'string',
        enum: Object.values(MESSAGE_ROLES),
        messages: {
            required: 'Message role is required',
            enum: 'Message role must be user, assistant, or system'
        }
    },
    content: {
        required: true,
        type: 'string',
        minLength: 1,
        maxLength: 100000,
        messages: {
            required: 'Message content is required',
            minLength: 'Message cannot be empty',
            maxLength: 'Message is too long'
        }
    }
};

export const validateMessage = createValidator(messageRules);
