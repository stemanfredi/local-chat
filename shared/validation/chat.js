import { createValidator } from './index.js';

export const chatRules = {
    title: {
        required: false,
        type: 'string',
        maxLength: 200,
        messages: {
            maxLength: 'Title must be at most 200 characters'
        }
    }
};

export const validateChat = createValidator(chatRules);
