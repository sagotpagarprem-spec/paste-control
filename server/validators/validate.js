// Universal Pest Control — Lightweight Input Validation Helpers
const { apiError } = require('../utils/response');

function validateEmail(email) {
  if (typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validatePhone(phone) {
  if (typeof phone !== 'string') return false;
  // Clean phone string to digits
  const cleaned = phone.replace(/[\s\-\+\(\)]/g, '');
  return cleaned.length >= 7 && cleaned.length <= 15;
}

// Validation middleware factory
function validate(validatorFn) {
  return (req, res, next) => {
    const errors = validatorFn(req.body);
    if (errors && errors.length > 0) {
      return apiError(res, 'Validation failed.', 422, errors);
    }
    next();
  };
}

// Specific Validators
function validateLogin(body) {
  const errors = [];
  if (!body.email || !validateEmail(body.email)) {
    errors.push({ field: 'email', message: 'A valid email address is required.' });
  }
  if (!body.password || typeof body.password !== 'string' || body.password.length < 6) {
    errors.push({ field: 'password', message: 'Password is required and must be at least 6 characters.' });
  }
  return errors;
}

function validateLeadCreate(body) {
  const errors = [];
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length < 2) {
    errors.push({ field: 'name', message: 'Customer name is required (min 2 characters).' });
  }
  if (!body.phone || !validatePhone(body.phone)) {
    errors.push({ field: 'phone', message: 'Valid contact phone number is required.' });
  }
  if (body.email && !validateEmail(body.email)) {
    errors.push({ field: 'email', message: 'Email address format is invalid.' });
  }
  const service = body.service || body.service_name;
  if (!service || typeof service !== 'string') {
    errors.push({ field: 'service', message: 'Service name is required.' });
  }
  return errors;
}

function validateBookingCreate(body) {
  const errors = [];
  const name = body.name || body.customerName || body.customer_name;
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push({ field: 'name', message: 'Customer name is required.' });
  }
  if (!body.phone || !validatePhone(body.phone)) {
    errors.push({ field: 'phone', message: 'Valid contact phone number is required.' });
  }
  const service = body.service || body.service_name;
  if (!service || typeof service !== 'string') {
    errors.push({ field: 'service', message: 'Service selection is required.' });
  }
  const date = body.date || body.scheduled_date;
  if (!date || typeof date !== 'string') {
    errors.push({ field: 'date', message: 'Scheduled date is required.' });
  }
  return errors;
}

module.exports = {
  validate,
  validateEmail,
  validatePhone,
  validateLogin,
  validateLeadCreate,
  validateBookingCreate
};
