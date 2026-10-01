// Field validators: each returns an error message, or null when the value is fine.

// Loose on purpose: people type numbers with spaces, brackets and dashes.
export const validatePhone = (v: string) =>
  /^\+?[\d\s()-]{6,20}$/.test(v) ? null : 'Enter a valid phone number, e.g. +61 400 000 000';

export const validateEmail = (v: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Enter a valid email address';

export const validateWebsite = (v: string) =>
  /^(https?:\/\/)?[^\s.]+\.[^\s]{2,}$/i.test(v) ? null : 'Enter a valid web address, e.g. example.com';
