import supabase from '../lib/supabase';
import { createNotification } from './notificationsService';
import { localDateStr } from '../utils/dateTime';

/**
 * Birthday Greetings Service
 * Checks for today's birthdays among contacts and employees.
 * Call on dashboard load.
 */

const CHECKED_KEY = 'platform_birthday_checked_date';

function alreadyCheckedToday() {
  const today = localDateStr();
  return localStorage.getItem(CHECKED_KEY) === today;
}

function markChecked() {
  localStorage.setItem(CHECKED_KEY, localDateStr());
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

  // NOTE: the employees table has no date-of-birth column, so there are no
  // employee birthdays to check. (An earlier version queried employees.birth_date,
  // which does not exist — that produced a 400 on every dashboard load and lit up
  // the "server connection failed" banner.) If a DOB column is added later,
  // re-introduce the check here against that real column.

  markChecked();
  return birthdayContacts;
}
