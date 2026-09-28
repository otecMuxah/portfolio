/** Completed years between birth and today, in local calendar dates. */
export function ageOn(birth: Date, today: Date): number {
  const beforeBirthday =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  return today.getFullYear() - birth.getFullYear() - (beforeBirthday ? 1 : 0);
}
