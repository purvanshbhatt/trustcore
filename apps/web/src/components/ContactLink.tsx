import React from 'react';
import { CONTACT_EMAIL, CONTACT_PLACEHOLDER } from '@/lib/site';

interface ContactLinkProps {
  /** Link text. Defaults to the address itself. */
  label?: string;
  /** Optional mail subject. */
  subject?: string;
  className?: string;
  /** Classes for the placeholder shown when no contact address is configured. */
  placeholderClassName?: string;
}

/**
 * Mail link to the configured contact address. When none is configured it renders
 * the placeholder text instead of an invented address.
 */
export function ContactLink({ label, subject, className = '', placeholderClassName }: ContactLinkProps) {
  if (CONTACT_EMAIL === '') {
    return <span className={placeholderClassName ?? className}>{CONTACT_PLACEHOLDER}</span>;
  }
  const href = subject
    ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`
    : `mailto:${CONTACT_EMAIL}`;
  return (
    <a href={href} className={className}>
      {label ?? CONTACT_EMAIL}
    </a>
  );
}
