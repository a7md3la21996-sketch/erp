import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { P } from '../config/roles';

/**
 * useCrmPermissions — granular CRM permission helpers
 * Returns booleans for contacts & opportunities actions
 */
export function useCrmPermissions() {
  const { hasPermission, profile } = useAuth();
  const userId = profile?.id;

  return useMemo(() => {
    // ── Contacts ──
    const canViewAllContacts = hasPermission(P.CONTACTS_VIEW_ALL);
    const canEditAnyContact = hasPermission(P.CONTACTS_EDIT);
    const canEditOwnContact = hasPermission(P.CONTACTS_EDIT_OWN);
    const canDeleteContacts = hasPermission(P.CONTACTS_DELETE);
    const canExportContacts = hasPermission(P.CONTACTS_EXPORT);
    const canImportContacts = hasPermission(P.CONTACTS_IMPORT);
    const canBulkContacts = hasPermission(P.CONTACTS_BULK);

    // Check if user can edit a specific contact
    const canEditContact = (contact) => {
      if (canEditAnyContact) return true;
      if (!canEditOwnContact) return false;
      // Own = assigned_to matches or user created it
      return contact?.assigned_to === userId || contact?.created_by === userId;
    };

    // ── Opportunities ──
    const canViewAllOpps = hasPermission(P.OPPS_VIEW_ALL);
    const canEditAnyOpp = hasPermission(P.OPPS_EDIT);
    const canEditOwnOpp = hasPermission(P.OPPS_EDIT_OWN);
    const canDeleteOpps = hasPermission(P.OPPS_DELETE);
    const canExportOpps = hasPermission(P.OPPS_EXPORT);
    const canBulkOpps = hasPermission(P.OPPS_BULK);

    // Check if user can edit a specific opportunity
    const canEditOpp = (opp) => {
      if (canEditAnyOpp) return true;
      if (!canEditOwnOpp) return false;
      return opp?.assigned_to === userId || opp?.created_by === userId;
    };

    return {
      // Contacts
      canViewAllContacts,
      canEditContact,
      canDeleteContacts,
      canExportContacts,
      canImportContacts,
      canBulkContacts,
      // Opportunities
      canViewAllOpps,
      canEditOpp,
      canDeleteOpps,
      canExportOpps,
      canBulkOpps,
    };
  }, [hasPermission, userId]);
}

export default useCrmPermissions;
