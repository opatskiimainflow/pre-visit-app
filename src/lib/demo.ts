/** Shared demo logins: nobody may change their password, or the demo breaks for everyone. */
export const isDemoEmail = (email: string | null | undefined) =>
  !!email && email.toLowerCase().endsWith("@demo.previsit.app");
