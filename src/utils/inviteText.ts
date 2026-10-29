/** What each non-usable invite status means for the person holding the link. */
export const INVITE_PROBLEMS: Record<string, { title: string; body: string }> = {
  expired: { title: 'This invite has expired', body: 'Invite links work for 7 days. Ask the person who invited you to send a new one.' },
  revoked: { title: 'This invite was cancelled', body: 'A newer invite may have replaced it. Check your email, or ask for a new one.' },
  accepted: { title: 'This invite has been used', body: 'Sign in to get to your organisation.' },
  invalid: { title: 'This invite link isn’t valid', body: 'Check you copied the whole link from the email, or ask for a new invite.' },
};

export const roleLabel = (role?: string | null) => (role === 'Admin' ? 'an Admin' : 'a Tutor');
