import { createValidator } from './index.js';

export const userRules = {
    username: {
        required: true,
        type: 'string',
        minLength: 3,
        maxLength: 30,
        pattern: /^[a-zA-Z0-9_]+$/,
        messages: {
            required: 'Username is required',
            minLength: 'Username must be at least 3 characters',
            maxLength: 'Username must be at most 30 characters',
            pattern: 'Username can only contain letters, numbers, and underscores'
        }
    },
    password: {
        required: true,
        type: 'string',
        minLength: 8,
        maxLength: 100,
        messages: {
            required: 'Password is required',
            minLength: 'Password must be at least 8 characters',
            maxLength: 'Password must be at most 100 characters'
        }
    }
};

export const validateUser = createValidator(userRules);
