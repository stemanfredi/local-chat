/**
 * Core validation function
 * @param {Object} data - Data to validate
 * @param {Object} rules - Validation rules
 * @param {string[]|null} fields - Specific fields to validate (null = all)
 * @returns {{valid: boolean, errors: Object}}
 */
export function validate(data, rules, fields = null) {
    const errors = {};
    const fieldsToValidate = fields || Object.keys(rules);

    for (const field of fieldsToValidate) {
        const rule = rules[field];
        if (!rule) continue;

        const value = data[field];

        // Required check
        if (rule.required && (value === undefined || value === null || value === '')) {
            errors[field] = rule.messages?.required || `${field} is required`;
            continue;
        }

        // Skip other validations if value is empty and not required
        if (value === undefined || value === null || value === '') {
            continue;
        }

        // Type check
        if (rule.type) {
            const actualType = Array.isArray(value) ? 'array' : typeof value;
            if (actualType !== rule.type) {
                errors[field] = rule.messages?.type || `${field} must be a ${rule.type}`;
                continue;
            }
        }

        // String validations
        if (typeof value === 'string') {
            if (rule.minLength && value.length < rule.minLength) {
                errors[field] = rule.messages?.minLength || `${field} must be at least ${rule.minLength} characters`;
            } else if (rule.maxLength && value.length > rule.maxLength) {
                errors[field] = rule.messages?.maxLength || `${field} must be at most ${rule.maxLength} characters`;
            } else if (rule.pattern && !rule.pattern.test(value)) {
                errors[field] = rule.messages?.pattern || `${field} format is invalid`;
            }
        }

        // Number validations
        if (typeof value === 'number') {
            if (rule.min !== undefined && value < rule.min) {
                errors[field] = rule.messages?.min || `${field} must be at least ${rule.min}`;
            } else if (rule.max !== undefined && value > rule.max) {
                errors[field] = rule.messages?.max || `${field} must be at most ${rule.max}`;
            }
        }

        // Enum validation
        if (rule.enum && !rule.enum.includes(value)) {
            errors[field] = rule.messages?.enum || `${field} must be one of: ${rule.enum.join(', ')}`;
        }

        // Custom validation
        if (rule.custom) {
            const customError = rule.custom(value, data);
            if (customError) {
                errors[field] = customError;
            }
        }
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors
    };
}

/**
 * Create a validator function for a specific set of rules
 * @param {Object} rules - Validation rules
 * @returns {function} Validator function
 */
export function createValidator(rules) {
    return (data, fields = null) => validate(data, rules, fields);
}
