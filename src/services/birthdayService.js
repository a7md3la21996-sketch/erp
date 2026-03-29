import supabase from '../lib/supabase';
import { createNotification } from './notificationsService';

/**
 * Birthday Greetings Service
 * Checks for today's birthdays among contacts and employees.
 * Call on dashboard load.
 */

const CHECKED_KEY = 'platform_birthday_checked_date';

function alreadyCheckedToday() {
  const today = new Date().toISOString().slice(0, 10);
  return localStorage.getItem(CHECKED_KEY) === today;
}

function markChecked() {
  localStorage.setItem(CHECKED_KEY, new Date().toISOString().slice(0, 10));
}

/**
 * Check for contact birthdays today and create notifications.
 */
export async function checkContactBirthdays(userId) {
  if (alreadyCheckedToday()) return [];

  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  let contacts = [];
  try {
    // Supabase: filter by month and day of birth_date
    const { data } = await supabase
      .from('contacts')
      .select('id, full_name, phone, birth_date, assigned_to_name')
      .not('birth_date', 'is', null)
      .range(0, 999);
    if (data) contacts = data;
  } catch {
    // Fallback
    try {
      contacts = JSON.parse(localStorage.getItem('platform_contacts') || '[]')
        .filter(c => c.birth_date);
    } catch { return []; }
  }

  const birthdayContacts = contacts.filter(c => {
    const bd = new Date(c.birth_date);
    return bd.getMonth() + 1 === month && bd.getDate() === day;
  });

  // Create notifications for each birthday
  birthdayContacts.forEach(c => {
    createNotification({
      type: 'reminder',
      title_ar: '🎂 عيد ميلاد عميل',
      title_en: '🎂 Client Birthday',
      body_ar: `النهاردة عيد ميلاد "${c.full_name}" — ابعتله تهنئة!`,
      body_en: `Today is "${c.full_name}"'s birthday — send greetings!`,
      for_user_id: userId || 'all',
      entity_type: 'contact',
      entity_id: c.id,
    });
  });

  // Check employee birthdays too
  let employees = [];
  try {
    const { data } = await supabase
      .from('employees')
      .select('id, full_name_ar, full_name_en, birth_date')
      .not('birth_date', 'is', null)
      .range(0, 499);
    if (data) employees = data;
  } catch {}

  const birthdayEmployees = employees.filter(e => {
    const bd = new Date(e.birth_date);
    return bd.getMonth() + 1 === month && bd.getDate() === day;
  });

  birthdayEmployees.forEach(e => {
    createNotification({
      type: 'reminder',
      title_ar: '🎂 عيد ميلاد موظف',
      title_en: '🎂 Employee Birthday',
      body_ar: `النهاردة عيد ميلاد "${e.full_name_ar || e.full_name_en}"`,
      body_en: `Today is "${e.full_name_en || e.full_name_ar}"'s birthday`,
      for_user_id: 'all',
      entity_type: 'employee',
      entity_id: e.id,
    });
  });

  markChecked();
  return [...birthdayContacts, ...birthdayEmployees];
}
